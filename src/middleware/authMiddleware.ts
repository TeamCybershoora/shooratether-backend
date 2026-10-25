/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/tokenHelper.js';
import { pool } from '../config/db.js';

export interface AuthenticatedRequest extends Request {
    user?: any;
    token?: string;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid token format.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Token has expired or is invalid.' });
    }

    try {
        const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [decoded.id]);
        if (rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Unauthorized: User not found.' });
        }

        const user = rows[0];
        if (user.status === 'suspended') {
            return res.status(403).json({ success: false, error: 'Forbidden: Account has been suspended.' });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (err: any) {
        return res.status(500).json({ success: false, error: 'Authentication check failed: ' + err.message });
    }
}

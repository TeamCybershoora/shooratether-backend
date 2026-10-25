/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/
import { verifyToken } from '../utils/tokenHelper.js';
import { pool } from '../config/db.js';
export async function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Admin token required.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.isAdmin) {
        return res.status(403).json({ success: false, error: 'Forbidden: Admin access required.' });
    }
    try {
        const [rows] = await pool.query('SELECT * FROM admin_users WHERE id = ? LIMIT 1', [decoded.id]);
        if (rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Forbidden: Admin user does not exist.' });
        }
        req.admin = rows[0];
        next();
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Admin check failed: ' + err.message });
    }
}

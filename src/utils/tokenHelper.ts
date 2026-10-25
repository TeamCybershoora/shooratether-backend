/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET: Secret = process.env.JWT_SECRET || 'shoora_tether_super_secret_jwt_key_2026';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '30d') as any;

export interface TokenPayload {
    id: number | string;
    email: string;
    name?: string;
    plan?: string;
    role?: string;
    [key: string]: any;
}

export function generateToken(payload: TokenPayload): string {
    const options: SignOptions = { expiresIn: JWT_EXPIRES_IN };
    return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyToken(token: string): any {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

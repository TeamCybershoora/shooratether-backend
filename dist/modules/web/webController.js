/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/
import { pool } from '../../config/db.js';
export async function getPlans(_req, res) {
    try {
        const [plans] = await pool.query('SELECT * FROM plans WHERE is_active = TRUE ORDER BY price_inr ASC');
        return res.json({ success: true, plans });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
export async function getWebProfile(req, res) {
    try {
        const user = req.user;
        return res.json({ success: true, profile: user });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
export async function updateWebProfile(req, res) {
    try {
        const userId = req.user.id;
        const { name } = req.body;
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Name cannot be empty.' });
        }
        await pool.query('UPDATE users SET name = ? WHERE id = ?', [name.trim(), userId]);
        return res.json({ success: true, message: 'Profile updated successfully.' });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

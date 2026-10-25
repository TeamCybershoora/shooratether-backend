/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/
import bcrypt from 'bcryptjs';
import { pool } from '../../config/db.js';
import { generateToken } from '../../utils/tokenHelper.js';
export async function adminLogin(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password required.' });
        }
        // 1. Check if admin exists in admin_users
        let [rows] = await pool.query('SELECT * FROM admin_users WHERE email = ? LIMIT 1', [email]);
        // If no admin user exists in DB yet, auto-bootstrap default admin from .env
        if (rows.length === 0) {
            const defaultEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@cybershoora.com';
            const defaultPass = process.env.ADMIN_DEFAULT_PASSWORD || 'ShooraAdmin@2026!';
            if (email === defaultEmail && password === defaultPass) {
                const hash = await bcrypt.hash(defaultPass, 10);
                await pool.query('INSERT INTO admin_users (email, password_hash, role) VALUES (?, ?, "superadmin")', [defaultEmail, hash]);
                const [created] = await pool.query('SELECT * FROM admin_users WHERE email = ? LIMIT 1', [defaultEmail]);
                rows = created;
            }
            else {
                return res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
            }
        }
        const admin = rows[0];
        const match = await bcrypt.compare(password, admin.password_hash);
        if (!match) {
            return res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
        }
        const token = generateToken({
            id: admin.id,
            email: admin.email,
            role: admin.role,
            isAdmin: true
        });
        return res.json({
            success: true,
            token,
            admin: {
                id: admin.id,
                email: admin.email,
                role: admin.role
            }
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
export async function getAdminStats(_req, res) {
    try {
        const [totalUsers] = await pool.query('SELECT COUNT(*) as count FROM users');
        const [activeUsers] = await pool.query('SELECT COUNT(*) as count FROM users WHERE status = "active"');
        const [planStats] = await pool.query('SELECT plan, COUNT(*) as count FROM users GROUP BY plan');
        const [totalSessions] = await pool.query('SELECT COUNT(*) as count FROM user_sessions');
        let totalRevenue = 0;
        try {
            const [rev] = await pool.query('SELECT SUM(amount) as totalRevenue FROM payments WHERE status = "success"');
            totalRevenue = rev[0]?.totalRevenue || 0;
        }
        catch { }
        return res.json({
            success: true,
            stats: {
                totalUsers: totalUsers[0]?.count || 0,
                activeUsers: activeUsers[0]?.count || 0,
                activeSessions: totalSessions[0]?.count || 0,
                totalRevenue,
                planBreakdown: planStats
            }
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
export async function getAdminUsers(req, res) {
    try {
        const search = req.query.search ? `%${req.query.search}%` : '%';
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const offset = (page - 1) * limit;
        const [users] = await pool.query(`SELECT id, email, name, avatar_url, auth_provider, plan, status, created_at, last_login 
             FROM users 
             WHERE email LIKE ? OR name LIKE ? 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`, [search, search, limit, offset]);
        const [total] = await pool.query('SELECT COUNT(*) as count FROM users WHERE email LIKE ? OR name LIKE ?', [search, search]);
        return res.json({
            success: true,
            data: users,
            pagination: {
                page,
                limit,
                total: total[0]?.count || 0,
                totalPages: Math.ceil((total[0]?.count || 0) / limit)
            }
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
export async function updateUserPlan(req, res) {
    try {
        const userId = req.params.id;
        const { plan } = req.body;
        const allowedPlans = ['free', 'pro', 'team', 'enterprise'];
        if (!allowedPlans.includes(plan)) {
            return res.status(400).json({ success: false, error: `Invalid plan. Allowed: ${allowedPlans.join(', ')}` });
        }
        await pool.query('UPDATE users SET plan = ? WHERE id = ?', [plan, userId]);
        return res.json({ success: true, message: `User plan successfully updated to ${plan}.` });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
export async function updateUserStatus(req, res) {
    try {
        const userId = req.params.id;
        const { status } = req.body;
        if (!['active', 'suspended', 'disabled'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Status must be active, suspended, or disabled.' });
        }
        await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
        return res.json({ success: true, message: `User status updated to ${status}.` });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
export async function updateUserDetails(req, res) {
    try {
        const userId = req.params.id;
        const { name, email, plan, status } = req.body;
        const allowedPlans = ['free', 'pro', 'team', 'enterprise'];
        if (plan && !allowedPlans.includes(plan)) {
            return res.status(400).json({ success: false, error: `Invalid plan. Allowed: ${allowedPlans.join(', ')}` });
        }
        if (status && !['active', 'suspended', 'disabled'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Status must be active, suspended, or disabled.' });
        }
        const updates = [];
        const params = [];
        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            params.push(email);
        }
        if (plan !== undefined) {
            updates.push('plan = ?');
            params.push(plan);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
        }
        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'No fields provided for update.' });
        }
        params.push(userId);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        return res.json({ success: true, message: 'User updated successfully.' });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
export async function deleteUser(req, res) {
    try {
        const userId = req.params.id;
        try {
            await pool.query('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
        }
        catch { }
        const [result] = await pool.query('DELETE FROM users WHERE id = ?', [userId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        return res.json({ success: true, message: `User #${userId} deleted successfully.` });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
export async function getAdminPayments(req, res) {
    try {
        const search = req.query.search ? `%${req.query.search}%` : '%';
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const offset = (page - 1) * limit;
        const [payments] = await pool.query(`SELECT id, user_id, user_email, user_name, plan_id, order_id, payment_id, amount, currency, status, created_at 
             FROM payments 
             WHERE user_email LIKE ? OR order_id LIKE ? OR payment_id LIKE ?
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`, [search, search, search, limit, offset]);
        const [total] = await pool.query('SELECT COUNT(*) as count FROM payments WHERE user_email LIKE ? OR order_id LIKE ? OR payment_id LIKE ?', [search, search, search]);
        const [rev] = await pool.query('SELECT SUM(amount) as totalRevenue FROM payments WHERE status = "success"');
        return res.json({
            success: true,
            data: payments || [],
            totalRevenue: rev[0]?.totalRevenue || 0,
            pagination: {
                page,
                limit,
                total: total[0]?.count || 0,
                totalPages: Math.ceil((total[0]?.count || 0) / limit)
            }
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

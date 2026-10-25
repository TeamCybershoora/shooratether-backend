/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/
import { generateToken } from '../../utils/tokenHelper.js';
import { pool } from '../../config/db.js';
export async function handleOAuthSuccess(req, res) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(400).send('OAuth login failed: No user profile received.');
        }
        // Generate JWT token
        const token = generateToken({
            id: user.id,
            email: user.email,
            name: user.name,
            plan: user.plan
        });
        // Store active session in MySQL DB
        try {
            const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '');
            const ua = String(req.headers['user-agent'] || '');
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
            await pool.query(`
                INSERT INTO user_sessions (user_id, token, ip_address, user_agent, expires_at)
                VALUES (?, ?, ?, ?, ?)
            `, [user.id, token, ip.substring(0, 45), ua.substring(0, 255), expiresAt]);
        }
        catch (dbErr) {
            console.warn('[Auth] Session store notice:', dbErr.message);
        }
        // Check if request came from desktop or web, or has custom redirect
        const state = String(req.query.state || '');
        const stateParams = new URLSearchParams(state);
        const source = stateParams.get('source') || (state.includes('source=web') ? 'web' : 'desktop');
        const customRedirect = stateParams.get('redirect');
        if (customRedirect) {
            const separator = customRedirect.includes('?') ? '&' : '?';
            return res.redirect(`${customRedirect}${separator}token=${encodeURIComponent(token)}`);
        }
        if (source === 'desktop') {
            // Serve the sleek deep link redirect page
            return res.redirect(`/auth-success.html?token=${encodeURIComponent(token)}`);
        }
        else {
            // Redirect to Cybershoora web dashboard or root
            const webUrl = process.env.WEB_CLIENT_URL || 'http://localhost:3000';
            return res.redirect(`${webUrl}/?token=${encodeURIComponent(token)}`);
        }
    }
    catch (err) {
        return res.status(500).send('Authentication Error: ' + err.message);
    }
}
export async function getMe(req, res) {
    try {
        const user = req.user;
        // Fetch plan limits and features
        let planDetails = {
            id: user.plan || 'free',
            displayName: user.plan === 'pro' ? 'Pro Developer' : 'Starter Free',
            aiTokenLimit: user.plan === 'pro' ? 1000000 : 50000,
            features: []
        };
        try {
            const [planRows] = await pool.query('SELECT * FROM plans WHERE id = ? LIMIT 1', [user.plan || 'free']);
            if (planRows.length > 0) {
                planDetails = {
                    id: planRows[0].id,
                    displayName: planRows[0].display_name,
                    aiTokenLimit: planRows[0].ai_token_limit,
                    features: planRows[0].features
                };
            }
        }
        catch { }
        return res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatar_url,
                authProvider: user.auth_provider,
                plan: user.plan || 'free',
                status: user.status,
                createdAt: user.created_at,
                planDetails
            }
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
export async function logout(req, res) {
    try {
        const token = req.token;
        if (token) {
            await pool.query('DELETE FROM user_sessions WHERE token = ?', [token]);
        }
        return res.json({ success: true, message: 'Logged out successfully.' });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

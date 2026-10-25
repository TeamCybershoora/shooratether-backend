/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const LOCAL_DB_FILE = path.join(DATA_DIR, 'local_db.json');
// Real MySQL pool
const rawMysqlPool = mysql.createPool({
    host: process.env.DB_HOST || 'sdb-79.hosting.stackcp.net',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'shooratether-353038339ef4',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'shooratether-353038339ef4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});
let isMysqlOnline = false;
// Local JSON Database Helper
function loadLocalDb() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(LOCAL_DB_FILE)) {
        const initial = {
            users: [],
            user_sessions: [],
            admin_users: [],
            payments: [],
            plans: [
                { id: 'free', display_name: 'Starter Free', price_inr: 0, price_usd: 0, ai_token_limit: 50000, features: ['25 AI Tools', 'Community Support', 'Basic Auto-Complete'], is_active: 1 },
                { id: 'pro', display_name: 'Pro Developer', price_inr: 999, price_usd: 12, ai_token_limit: 1000000, features: ['Unlimited AI Autocomplete', 'Codebase RAG', 'AWS Deployments', 'Priority Models'], is_active: 1 },
                { id: 'team', display_name: 'Enterprise Team', price_inr: 2499, price_usd: 29, ai_token_limit: 5000000, features: ['Custom Models', 'Dedicated Cloud Agent', 'Admin Analytics', '24/7 SLA Support'], is_active: 1 }
            ]
        };
        fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
        return initial;
    }
    try {
        return JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8'));
    }
    catch {
        return { users: [], user_sessions: [], admin_users: [], payments: [], plans: [] };
    }
}
function saveLocalDb(data) {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}
// Emulates basic MySQL queries on local storage when remote MySQL is unreachable from localhost
async function executeLocalQuery(sql, params = []) {
    const db = loadLocalDb();
    const cleanSql = sql.trim().replace(/\s+/g, ' ');
    // 1. SELECT * FROM users WHERE email = ? OR (auth_provider = ? AND provider_id = ?)
    if (cleanSql.includes('SELECT * FROM users WHERE email = ?') || cleanSql.includes('auth_provider = ?')) {
        const [email, provider, providerId] = params;
        const found = db.users.filter(u => u.email === email || (u.auth_provider === provider && u.provider_id === providerId));
        return [found, []];
    }
    // 2. SELECT * FROM users WHERE id = ?
    if (cleanSql.includes('SELECT * FROM users WHERE id = ?')) {
        const [id] = params;
        const found = db.users.filter(u => Number(u.id) === Number(id));
        return [found, []];
    }
    // 3. UPDATE users SET last_login = NOW() WHERE id = ?
    if (cleanSql.includes('UPDATE users SET last_login')) {
        const id = params[params.length - 1];
        const user = db.users.find(u => Number(u.id) === Number(id));
        if (user)
            user.last_login = new Date().toISOString();
        saveLocalDb(db);
        return [{ affectedRows: 1 }, []];
    }
    // 4. UPDATE users SET plan = ? WHERE id = ?
    if (cleanSql.includes('UPDATE users SET plan = ? WHERE id = ?')) {
        const [plan, id] = params;
        const user = db.users.find(u => Number(u.id) === Number(id));
        if (user) {
            user.plan = plan;
            if (plan === 'pro')
                user.tokens_limit = 1000000;
            else if (plan === 'team')
                user.tokens_limit = 5000000;
            else if (plan === 'enterprise')
                user.tokens_limit = 20000000;
            else
                user.tokens_limit = 50000;
        }
        saveLocalDb(db);
        return [{ affectedRows: 1 }, []];
    }
    // 4b. UPDATE users SET tokens_used = tokens_used + ? WHERE id = ?
    if (cleanSql.includes('UPDATE users SET tokens_used = tokens_used + ?')) {
        const [tokensToAdd, id] = params;
        const user = db.users.find(u => Number(u.id) === Number(id));
        if (user) {
            user.tokens_used = (Number(user.tokens_used) || 0) + Number(tokensToAdd);
        }
        saveLocalDb(db);
        return [{ affectedRows: 1 }, []];
    }
    // 5. UPDATE users SET status = ? WHERE id = ?
    if (cleanSql.includes('UPDATE users SET status = ? WHERE id = ?')) {
        const [status, id] = params;
        const user = db.users.find(u => Number(u.id) === Number(id));
        if (user)
            user.status = status;
        saveLocalDb(db);
        return [{ affectedRows: 1 }, []];
    }
    // 6. INSERT INTO users
    if (cleanSql.startsWith('INSERT INTO users')) {
        const [email, name, avatarUrl, provider, providerId] = params;
        const nextId = db.users.length > 0 ? Math.max(...db.users.map(u => Number(u.id) || 0)) + 1 : 1;
        const newUser = {
            id: nextId,
            email,
            name: name || email.split('@')[0],
            avatar_url: avatarUrl || '',
            auth_provider: provider || 'email',
            provider_id: providerId || String(nextId),
            plan: 'free',
            tokens_used: 0,
            tokens_limit: 50000,
            status: 'active',
            metadata: { initial_source: 'oauth' },
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
        };
        db.users.push(newUser);
        saveLocalDb(db);
        return [{ insertId: nextId, affectedRows: 1 }, []];
    }
    // 7. INSERT INTO user_sessions
    if (cleanSql.startsWith('INSERT INTO user_sessions')) {
        const [userId, token, ip, ua, expiresAt] = params;
        const nextId = db.user_sessions.length + 1;
        db.user_sessions.push({
            id: nextId,
            user_id: userId,
            token,
            ip_address: ip,
            user_agent: ua,
            expires_at: expiresAt,
            created_at: new Date().toISOString()
        });
        saveLocalDb(db);
        return [{ insertId: nextId, affectedRows: 1 }, []];
    }
    // 8. DELETE FROM user_sessions WHERE token = ?
    if (cleanSql.includes('DELETE FROM user_sessions WHERE token = ?')) {
        const [token] = params;
        db.user_sessions = db.user_sessions.filter(s => s.token !== token);
        saveLocalDb(db);
        return [{ affectedRows: 1 }, []];
    }
    // 9. SELECT * FROM plans WHERE id = ?
    if (cleanSql.includes('SELECT * FROM plans WHERE id = ?')) {
        const [id] = params;
        const plan = db.plans.filter(p => p.id === id);
        return [plan, []];
    }
    // 10. SELECT * FROM admin_users WHERE id = ? or email = ?
    if (cleanSql.includes('FROM admin_users WHERE id = ?')) {
        const [id] = params;
        const found = db.admin_users.filter(a => Number(a.id) === Number(id));
        return [found, []];
    }
    if (cleanSql.includes('FROM admin_users WHERE email = ?')) {
        const [email] = params;
        const found = db.admin_users.filter(a => a.email === email);
        return [found, []];
    }
    // 11. INSERT INTO admin_users
    if (cleanSql.startsWith('INSERT INTO admin_users')) {
        const [email, passwordHash, role] = params;
        const nextId = db.admin_users.length + 1;
        const newAdmin = {
            id: nextId,
            email,
            password_hash: passwordHash,
            role: role || 'superadmin',
            created_at: new Date().toISOString()
        };
        db.admin_users.push(newAdmin);
        saveLocalDb(db);
        return [{ insertId: nextId, affectedRows: 1 }, []];
    }
    // 12. Admin Stats
    if (cleanSql.includes('COUNT(*) as count FROM users WHERE status = "active"')) {
        const count = db.users.filter(u => u.status === 'active').length;
        return [[{ count }], []];
    }
    if (cleanSql.includes('COUNT(*) as count FROM users')) {
        return [[{ count: db.users.length }], []];
    }
    if (cleanSql.includes('COUNT(*) as count FROM user_sessions')) {
        return [[{ count: db.user_sessions.length }], []];
    }
    if (cleanSql.includes('plan, COUNT(*) as count FROM users GROUP BY plan')) {
        const counts = {};
        db.users.forEach(u => {
            const p = u.plan || 'free';
            counts[p] = (counts[p] || 0) + 1;
        });
        const rows = Object.entries(counts).map(([plan, count]) => ({ plan, count }));
        return [rows, []];
    }
    // 13. Admin Users List with search & pagination
    if (cleanSql.includes('FROM users WHERE email LIKE ? OR name LIKE ?')) {
        const searchPattern = (params[0] || '%').replace(/%/g, '').toLowerCase();
        let filtered = db.users;
        if (searchPattern) {
            filtered = db.users.filter(u => (u.email && u.email.toLowerCase().includes(searchPattern)) ||
                (u.name && u.name.toLowerCase().includes(searchPattern)));
        }
        if (cleanSql.includes('SELECT COUNT(*) as count')) {
            return [[{ count: filtered.length }], []];
        }
        // Apply pagination
        const limit = Number(params[params.length - 2]) || 20;
        const offset = Number(params[params.length - 1]) || 0;
        const paged = filtered.slice(offset, offset + limit);
        return [paged, []];
    }
    // 14. INSERT INTO payments
    if (cleanSql.startsWith('INSERT INTO payments')) {
        db.payments = db.payments || [];
        const [userId, userEmail, userName, planId, orderId, paymentId, amount, currency, status] = params;
        const nextId = db.payments.length + 1;
        const newPayment = {
            id: nextId,
            user_id: userId,
            user_email: userEmail,
            user_name: userName || userEmail.split('@')[0],
            plan_id: planId,
            order_id: orderId,
            payment_id: paymentId,
            amount: Number(amount) || 0,
            currency: currency || 'INR',
            status: status || 'success',
            created_at: new Date().toISOString()
        };
        db.payments.unshift(newPayment);
        saveLocalDb(db);
        return [{ insertId: nextId, affectedRows: 1 }, []];
    }
    // 15. SELECT Payments for Admin
    if (cleanSql.includes('FROM payments')) {
        db.payments = db.payments || [];
        if (cleanSql.includes('COUNT(*) as count')) {
            return [[{ count: db.payments.length }], []];
        }
        if (cleanSql.includes('SUM(amount) as totalRevenue')) {
            const total = db.payments
                .filter(p => p.status === 'success')
                .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
            return [[{ totalRevenue: total }], []];
        }
        const searchPattern = params[0] ? String(params[0]).replace(/%/g, '').toLowerCase() : '';
        let filtered = db.payments;
        if (searchPattern) {
            filtered = db.payments.filter(p => (p.user_email && p.user_email.toLowerCase().includes(searchPattern)) ||
                (p.order_id && p.order_id.toLowerCase().includes(searchPattern)) ||
                (p.payment_id && p.payment_id.toLowerCase().includes(searchPattern)) ||
                (p.plan_id && p.plan_id.toLowerCase().includes(searchPattern)));
        }
        const limit = Number(params[params.length - 2]) || 20;
        const offset = Number(params[params.length - 1]) || 0;
        const paged = filtered.slice(offset, offset + limit);
        return [paged, []];
    }
    // Default fallback
    return [[], []];
}
// Unified Smart Pool Interface
export const pool = {
    async query(sql, params = []) {
        if (isMysqlOnline) {
            try {
                return await rawMysqlPool.query(sql, params);
            }
            catch (err) {
                // If MySQL dropped or failed, fallback to local store
                console.warn('[Database] MySQL query failed, using local fallback:', err.message);
                return await executeLocalQuery(sql, params);
            }
        }
        return await executeLocalQuery(sql, params);
    },
    async getConnection() {
        if (isMysqlOnline) {
            try {
                return await rawMysqlPool.getConnection();
            }
            catch {
                // Fallback virtual connection
            }
        }
        return {
            query: async (sql, params) => executeLocalQuery(sql, params),
            release: () => { }
        };
    }
};
/**
 * Initializes tables if they don't already exist in the database.
 */
export async function initializeDatabase() {
    const host = process.env.DB_HOST || 'sdb-79.hosting.stackcp.net';
    const port = Number(process.env.DB_PORT) || 3306;
    try {
        console.log(`[Database] Testing connection to MySQL at ${host}:${port}...`);
        const conn = await rawMysqlPool.getConnection();
        isMysqlOnline = true;
        console.log('[Database] ✓ Connected to MySQL (StackCP Production DB) successfully!');
        // 1. Create Users Table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                name VARCHAR(255) NULL,
                avatar_url VARCHAR(500) NULL,
                auth_provider ENUM('google', 'github', 'email') NOT NULL,
                provider_id VARCHAR(255) NOT NULL,
                plan VARCHAR(50) DEFAULT 'free',
                status ENUM('active', 'suspended', 'pending') DEFAULT 'active',
                metadata JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX (email),
                INDEX (provider_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        // 2. Create User Sessions Table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token VARCHAR(500) NOT NULL,
                ip_address VARCHAR(45) NULL,
                user_agent VARCHAR(255) NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX (token)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        // 3. Create Admin Users Table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS admin_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('superadmin', 'admin', 'moderator') DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        // 4. Create Plans Table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS plans (
                id VARCHAR(50) PRIMARY KEY,
                display_name VARCHAR(100) NOT NULL,
                price_inr INT NOT NULL DEFAULT 0,
                price_usd INT NOT NULL DEFAULT 0,
                ai_token_limit INT NOT NULL DEFAULT 100000,
                features JSON NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        // 5. Seed default plans if empty
        const [planRows] = await conn.query('SELECT COUNT(*) as count FROM plans');
        if (planRows[0].count === 0) {
            await conn.query(`
                INSERT INTO plans (id, display_name, price_inr, price_usd, ai_token_limit, features) VALUES
                ('free', 'Starter Free', 0, 0, 50000, '["25 AI Tools", "Community Support", "Basic Auto-Complete"]'),
                ('pro', 'Pro Developer', 999, 12, 1000000, '["Unlimited AI Autocomplete", "Codebase RAG", "AWS Deployments", "Priority Models"]'),
                ('team', 'Enterprise Team', 2499, 29, 5000000, '["Custom Models", "Dedicated Cloud Agent", "Admin Analytics", "24/7 SLA Support"]');
            `);
            console.log('[Database] Seeded default subscription plans.');
        }
        // 6. Create Payments / Orders Table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                user_email VARCHAR(255) NOT NULL,
                user_name VARCHAR(255) NULL,
                plan_id VARCHAR(50) NOT NULL,
                order_id VARCHAR(100) NOT NULL,
                payment_id VARCHAR(100) NOT NULL,
                amount INT NOT NULL,
                currency VARCHAR(10) DEFAULT 'INR',
                status ENUM('success', 'failed', 'refunded') DEFAULT 'success',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (user_id),
                INDEX (order_id),
                INDEX (payment_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        conn.release();
        console.log('[Database] MySQL Schema verified and ready.');
    }
    catch (err) {
        isMysqlOnline = false;
        console.warn(`[Database] Notice: ${err.message}`);
        console.log('[Database] 🛡️  Running in Local Resilient Mode: Using persistent local database.');
        console.log('[Database] ℹ️  (StackCP internal hostname sdb-79.hosting.stackcp.net will automatically connect when deployed to StackCP hosting).');
        loadLocalDb();
    }
}

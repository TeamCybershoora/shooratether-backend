/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { pool } from './db.js';
import dotenv from 'dotenv';
dotenv.config();
/**
 * Helper to find or create a user in the MySQL database
 */
export async function findOrCreateUser({ email, name, avatarUrl, provider, providerId }) {
    const conn = await pool.getConnection();
    try {
        // 1. Check if user exists by email or providerId
        const [existing] = await conn.query('SELECT * FROM users WHERE email = ? OR (auth_provider = ? AND provider_id = ?) LIMIT 1', [email, provider, providerId]);
        if (existing.length > 0) {
            const user = existing[0];
            // Update last_login
            await conn.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
            return user;
        }
        // 2. Insert new user
        const [result] = await conn.query(`
            INSERT INTO users (email, name, avatar_url, auth_provider, provider_id, plan, status, metadata)
            VALUES (?, ?, ?, ?, ?, 'free', 'active', JSON_OBJECT('initial_source', 'oauth'))
        `, [email, name, avatarUrl, provider, providerId]);
        const [newUser] = await conn.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
        return newUser[0];
    }
    finally {
        conn.release();
    }
}
// ============================================================================
// Google OAuth Strategy
// ============================================================================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
    }, async (_accessToken, _refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
                return done(new Error('Google profile does not contain an email address.'));
            }
            const user = await findOrCreateUser({
                email,
                name: profile.displayName || profile.name?.givenName || 'Shoora User',
                avatarUrl: profile.photos?.[0]?.value || '',
                provider: 'google',
                providerId: profile.id
            });
            return done(null, user);
        }
        catch (err) {
            return done(err);
        }
    }));
    console.log('[Passport] Google OAuth 2.0 Strategy loaded.');
}
else {
    console.warn('[Passport] Notice: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing in .env');
}
// ============================================================================
// GitHub OAuth Strategy
// ============================================================================
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/api/auth/github/callback',
        scope: ['user:email']
    }, async (_accessToken, _refreshToken, profile, done) => {
        try {
            let email = profile.emails?.[0]?.value;
            // Fallback for private github emails
            if (!email) {
                email = `${profile.username}@users.noreply.github.com`;
            }
            const user = await findOrCreateUser({
                email,
                name: profile.displayName || profile.username || 'Shoora Developer',
                avatarUrl: profile.photos?.[0]?.value || '',
                provider: 'github',
                providerId: String(profile.id)
            });
            return done(null, user);
        }
        catch (err) {
            return done(err);
        }
    }));
    console.log('[Passport] GitHub OAuth Strategy loaded.');
}
else {
    console.warn('[Passport] Notice: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET missing in .env');
}
export default passport;

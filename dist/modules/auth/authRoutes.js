/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/
import { Router } from 'express';
import passport from '../../config/passport.js';
import { handleOAuthSuccess, getMe, logout } from './authController.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
const router = Router();
// ============================================================================
// Google OAuth Routes
// ============================================================================
router.get('/google', (req, res, next) => {
    const source = req.query.source || 'desktop';
    const redirect = req.query.redirect || '';
    const state = `source=${encodeURIComponent(source)}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}`;
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state,
        session: false
    })(req, res, next);
});
router.get('/google/callback', (req, res, next) => {
    passport.authenticate('google', { session: false, failureRedirect: '/auth-failed.html' }, (err, user) => {
        if (err || !user) {
            return res.redirect('/auth-failed.html?error=' + encodeURIComponent(err?.message || 'Google Auth Failed'));
        }
        req.user = user;
        return handleOAuthSuccess(req, res);
    })(req, res, next);
});
// ============================================================================
// GitHub OAuth Routes
// ============================================================================
router.get('/github', (req, res, next) => {
    const source = req.query.source || 'desktop';
    const redirect = req.query.redirect || '';
    const state = `source=${encodeURIComponent(source)}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}`;
    passport.authenticate('github', {
        scope: ['user:email'],
        state,
        session: false
    })(req, res, next);
});
router.get('/github/callback', (req, res, next) => {
    passport.authenticate('github', { session: false, failureRedirect: '/auth-failed.html' }, (err, user) => {
        if (err || !user) {
            return res.redirect('/auth-failed.html?error=' + encodeURIComponent(err?.message || 'GitHub Auth Failed'));
        }
        req.user = user;
        return handleOAuthSuccess(req, res);
    })(req, res, next);
});
// ============================================================================
// Current User Profile & Session Routes
// ============================================================================
router.get('/me', requireAuth, getMe);
router.post('/logout', requireAuth, logout);
export default router;

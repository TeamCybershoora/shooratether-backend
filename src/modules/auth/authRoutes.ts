/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Router, Request, Response, NextFunction } from 'express';
import passport from '../../config/passport.js';
import { handleOAuthSuccess, getMe, logout } from './authController.js';
import { requireAuth } from '../../middleware/authMiddleware.js';

const router = Router();

// ============================================================================
// Google OAuth Routes
// ============================================================================
router.get('/google', (req: Request, res: Response, next: NextFunction) => {
    const source = (req.query.source as string) || 'desktop';
    const redirect = (req.query.redirect as string) || '';
    const state = `source=${encodeURIComponent(source)}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}`;
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state,
        session: false
    })(req, res, next);
});

router.get('/google/callback', (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', { session: false, failureRedirect: '/auth-failed.html' }, (err: any, user: any) => {
        if (err || !user) {
            return res.redirect('/auth-failed.html?error=' + encodeURIComponent(err?.message || 'Google Auth Failed'));
        }
        (req as any).user = user;
        return handleOAuthSuccess(req, res);
    })(req, res, next);
});

// ============================================================================
// GitHub OAuth Routes
// ============================================================================
router.get('/github', (req: Request, res: Response, next: NextFunction) => {
    const source = (req.query.source as string) || 'desktop';
    const redirect = (req.query.redirect as string) || '';
    const state = `source=${encodeURIComponent(source)}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}`;
    passport.authenticate('github', {
        scope: ['user:email'],
        state,
        session: false
    })(req, res, next);
});

router.get('/github/callback', (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('github', { session: false, failureRedirect: '/auth-failed.html' }, (err: any, user: any) => {
        if (err || !user) {
            return res.redirect('/auth-failed.html?error=' + encodeURIComponent(err?.message || 'GitHub Auth Failed'));
        }
        (req as any).user = user;
        return handleOAuthSuccess(req, res);
    })(req, res, next);
});

// ============================================================================
// Current User Profile & Session Routes
// ============================================================================
router.get('/me', requireAuth, getMe);
router.post('/logout', requireAuth, logout);

export default router;

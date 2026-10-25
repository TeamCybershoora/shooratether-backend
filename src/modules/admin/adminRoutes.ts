/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Router } from 'express';
import {
    adminLogin,
    getAdminStats,
    getAdminUsers,
    getAdminPayments,
    updateUserPlan,
    updateUserStatus,
    updateUserDetails,
    deleteUser
} from './adminController.js';
import { requireAdmin } from '../../middleware/adminMiddleware.js';

const router = Router();

// Public Admin Login
router.post('/login', adminLogin);

// Protected Admin Routes
router.get('/stats', requireAdmin, getAdminStats);
router.get('/users', requireAdmin, getAdminUsers);
router.get('/payments', requireAdmin, getAdminPayments);
router.put('/users/:id', requireAdmin, updateUserDetails);
router.put('/users/:id/plan', requireAdmin, updateUserPlan);
router.put('/users/:id/status', requireAdmin, updateUserStatus);
router.delete('/users/:id', requireAdmin, deleteUser);

export default router;

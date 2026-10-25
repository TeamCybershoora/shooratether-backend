/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Router } from 'express';
import {
    getPaymentConfig,
    createPaymentOrder,
    verifyPayment,
    handleWebhook
} from './paymentController.js';
import { requireAuth } from '../../middleware/authMiddleware.js';

const router = Router();

// Public config to fetch Razorpay public Key ID
router.get('/config', getPaymentConfig);

// Authenticated routes
router.post('/create-order', requireAuth, createPaymentOrder);
router.post('/verify', requireAuth, verifyPayment);
router.post('/webhook', handleWebhook);

export default router;

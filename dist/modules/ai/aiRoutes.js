/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/
import { Router } from 'express';
import { getAiUsage, proxyAgentChat } from './aiController.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
const router = Router();
// Current User AI Token Quota & Available Models
router.get('/usage', requireAuth, getAiUsage);
// Managed Pro AI Gateway Proxy
router.post('/agent-chat', requireAuth, proxyAgentChat);
export default router;

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { Router } from 'express';
import { getPlans, getWebProfile, updateWebProfile } from './webController.js';
import { requireAuth } from '../../middleware/authMiddleware.js';

const router = Router();

router.get('/plans', getPlans);
router.get('/profile', requireAuth, getWebProfile);
router.put('/profile', requireAuth, updateWebProfile);

export default router;

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { pool } from '../../config/db.js';
let razorpayInstance = null;
function getRazorpayInstance() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (keyId && keySecret && keyId.startsWith('rzp_') && keyId !== 'RAZORPAY_KEY_ID') {
        if (!razorpayInstance) {
            razorpayInstance = new Razorpay({
                key_id: keyId,
                key_secret: keySecret
            });
            console.log('[Razorpay] Initialized with Key ID:', keyId);
        }
        return razorpayInstance;
    }
    return null;
}
/**
 * Returns public Razorpay Key ID for frontend Checkout SDK
 */
export async function getPaymentConfig(_req, res) {
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    const isConfigured = keyId.startsWith('rzp_') && keyId !== 'RAZORPAY_KEY_ID';
    return res.json({
        success: true,
        keyId: isConfigured ? keyId : 'rzp_test_ShooraDemoKey',
        isLive: isConfigured && !keyId.startsWith('rzp_test'),
        currency: 'INR'
    });
}
/**
 * Creates a Razorpay Order (or simulated order in test mode)
 */
export async function createPaymentOrder(req, res) {
    try {
        const user = req.user;
        const { planId } = req.body;
        if (!planId) {
            return res.status(400).json({ success: false, error: 'planId is required.' });
        }
        const [plans] = await pool.query('SELECT * FROM plans WHERE id = ? LIMIT 1', [planId]);
        if (plans.length === 0) {
            return res.status(404).json({ success: false, error: 'Subscription plan not found.' });
        }
        const plan = plans[0];
        const rzp = getRazorpayInstance();
        let order;
        if (rzp) {
            // Real Razorpay API Order Creation
            order = await rzp.orders.create({
                amount: Math.round(plan.price_inr * 100), // in paise
                currency: 'INR',
                receipt: `rcpt_${user.id}_${Date.now()}`,
                notes: {
                    userId: String(user.id),
                    userEmail: user.email,
                    planId: plan.id
                }
            });
        }
        else {
            // Test / Simulation Mode (when real key is not yet set)
            order = {
                id: `order_sim_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                amount: Math.round(plan.price_inr * 100),
                currency: 'INR',
                status: 'created',
                notes: {
                    userId: String(user.id),
                    userEmail: user.email,
                    planId: plan.id,
                    mode: 'test_simulation'
                }
            };
        }
        return res.json({
            success: true,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
                planId: plan.id,
                planName: plan.display_name,
                user: {
                    name: user.name || user.email.split('@')[0],
                    email: user.email
                }
            }
        });
    }
    catch (err) {
        console.error('[Payment] Create Order Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
/**
 * Verifies Razorpay payment signature & upgrades user plan in MySQL DB
 */
export async function verifyPayment(req, res) {
    try {
        const user = req.user;
        const { planId, orderId, paymentId, signature } = req.body;
        if (!planId || !orderId || !paymentId) {
            return res.status(400).json({ success: false, error: 'Missing required payment details.' });
        }
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        const rzp = getRazorpayInstance();
        // Verify cryptographic signature if live/test secret is set
        if (rzp && keySecret && signature) {
            const hmac = crypto.createHmac('sha256', keySecret);
            hmac.update(`${orderId}|${paymentId}`);
            const generatedSignature = hmac.digest('hex');
            if (generatedSignature !== signature) {
                return res.status(400).json({ success: false, error: 'Payment signature verification failed.' });
            }
        }
        // Fetch plan details to log price
        const [plans] = await pool.query('SELECT * FROM plans WHERE id = ? LIMIT 1', [planId]);
        const planPrice = plans[0]?.price_inr || 999;
        // 1. Upgrade User Plan in MySQL DB
        await pool.query('UPDATE users SET plan = ? WHERE id = ?', [planId, user.id]);
        // 2. Insert into Payments Record Table
        await pool.query(`
            INSERT INTO payments (user_id, user_email, user_name, plan_id, order_id, payment_id, amount, currency, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', 'success')
        `, [user.id, user.email, user.name || user.email.split('@')[0], planId, orderId, paymentId, planPrice]);
        console.log(`[Payment] User #${user.id} (${user.email}) upgraded to plan: ${planId.toUpperCase()}!`);
        return res.json({
            success: true,
            message: `Congratulations! Your account has been upgraded to ${planId.toUpperCase()} plan.`,
            plan: planId,
            paymentId
        });
    }
    catch (err) {
        console.error('[Payment] Verify Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
/**
 * Razorpay Webhook Handler
 */
export async function handleWebhook(req, res) {
    console.log('[Webhook] Razorpay event received:', req.body?.event);
    return res.status(200).json({ received: true });
}

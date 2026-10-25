/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Cybershoora Pvt. Ltd. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/db.js';
import passport from './config/passport.js';
import authRoutes from './modules/auth/authRoutes.js';
import webRoutes from './modules/web/webRoutes.js';
import adminRoutes from './modules/admin/adminRoutes.js';
import paymentRoutes from './modules/payments/paymentRoutes.js';
import aiRoutes from './modules/ai/aiRoutes.js';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 5000;
// Security & Parsing Middlewares
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts for auth-success.html deep links
}));
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
// Passport Authentication
app.use(passport.initialize());
// Static Files (e.g. auth-success.html, auth-failed.html)
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));
// API Health Check
app.get('/health', (_req, res) => {
    res.json({
        status: 'online',
        service: 'SHOORA TETHER Central Backend API (TypeScript)',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});
// Mount Central API Modules
app.use('/api/auth', authRoutes);
app.use('/api/web', webRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai', aiRoutes);
// Fallback 404
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found.' });
});
// Global Error Handler
app.use((err, _req, res, _next) => {
    console.error('[Server Error]', err);
    res.status(500).json({ success: false, error: err?.message || 'Internal Server Error' });
});
// Start Server & Initialize Database
app.listen(PORT, async () => {
    console.log('====================================================');
    console.log(`⚡ SHOORA TETHER BACKEND API (TypeScript) running on port ${PORT}`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🔐 Google Auth: http://localhost:${PORT}/api/auth/google`);
    console.log(`🐙 GitHub Auth: http://localhost:${PORT}/api/auth/github`);
    console.log(`👑 Admin API:   http://localhost:${PORT}/api/admin`);
    console.log('====================================================');
    await initializeDatabase();
});
export default app;

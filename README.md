# SHOORA TETHER - Unified Central Backend API (TypeScript)

Unified central backend service for the **SHOORA TETHER** ecosystem (Web, Desktop IDE, Admin Control Hub, AI Proxy, and Payments).

---

## ⚡ Features

- **TypeScript Native**: Clean modular architecture running on Node.js / `tsx`.
- **OAuth Authentication**: Google OAuth 2.0 & GitHub OAuth integration with deep linking redirect support for Shoora Tether Desktop IDE (`shooratether://auth/callback`).
- **Database Layer**: Production StackCP MySQL database with automatic local resilient fallback.
- **Razorpay Payments**: Payment creation and webhook handling for Pro/Team subscriptions.
- **Enterprise Admin Portal API**: JWT-protected admin routes for user management, tier changes, and financial ledger telemetry.
- **AI Proxy Gateway**: Centralized proxy routing to Gemini 2.5 Pro and Flash with tier-based quota validation and Bring-Your-Own-Key (BYOK) support.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
npm run start:dist
```

---

## 🛡️ License
Copyright (c) 2026 Cybershoora Pvt. Ltd. All rights reserved.

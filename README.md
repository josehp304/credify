# Credify — Unified Trust & Fraud Prevention Ecosystem

> **AI-Powered Fraud Prevention & Document Verification**  
> v1.0 · Product Release · March 2026

Credify is a multi-dimensional fraud prevention platform and document verification suite designed to protect eCommerce, ed-tech, and digital services from AI-assisted deception. By leveraging advanced forensics, cryptographic watermarking, and a shared **Unified Trust Score**, we provide a cross-platform credibility index that identifies malicious actors before they strike.

---

## 🏗️ Project Architecture & Nature

Credify is built as a **decoupled, multi-service ecosystem** that functions both as a specialized API engine and a centralized management platform. The project is designed with a clear separation between the "Verification Engine" and the "Identity/Dashboard" layers.

### **The Core Philosophy: "Cross-Platform Memory"**

Traditional fraud detection works in silos. Credify’s core innovation is the **Unified Trust Score**. Every user interaction—whether submitting a refund request, having a certificate verified, or posting a product review—contributes to a global reputation index stored in our **Neon Database**.

- **Nature of the Project**: A security-as-a-service (SaaS) platform that democratizes high-end AI forensics and cryptographic verification for businesses of all sizes.
- **Project Structure**:
  - `root/`: Next.js Frontend (Identity management, Dashboard, Feature Showcase).
  - `backend/`: Express.js API (AI forensics, image processing, OCR, Drizzle-powered DB interactions).
  - `backend/src/utils/`: Centralized verification logic (AI detection, EXIF, steganography).
  - `src/lib/auth/`: Integrated authentication via **Neon Auth**, bridging the gap between database identity and web session.

---

## 📈 Direction & Evolution

We have moved from a feature-isolated hackathon prototype to a fully integrated, identity-focused platform. The development direction is currently focused on:

1.  **Unified Authentication**: Migrating from hardcoded guest sessions to **Neon Auth**, enabling persistent trust profiles that follow a user across different partner platforms.
2.  **Automated Trust Profiling**: Implementing logic that dynamically creates trust scores upon a user's first interaction and updates them in real-time based on the "verdict" of our AI models.
3.  **Scalable Multi-Service APIs**: Refining each feature (Refund, Documents, ID, Reviews) into autonomous routes that can be consumed as-is or as part of a larger workflow.

---

## 🚀 Core Features

### 1. Refund Image Verification

Detects AI-generated or modified photographs used for fraudulent refund claims.

- **Pipeline**: C2PA provenance (signed Content Credentials, parsed locally) → AI forensics (Hive AI, with Gemini fallback) → Metadata Analysis (EXIF) → Cross-platform history (Trust DB).
- **Endpoint**: `POST /api/v1/refund/verify`

### 2. Document Watermarking & Verification

Cryptographically fingerprinted digital certificates (Degrees, Internships, Agreements).

- **Mechanism**: Invisible steganographic payload embedding at issuance.
- **Tamper Evidence**: AI-regeneration or tampering fundamentally breaks the pixel-level pattern.
- **Endpoints**: `POST /api/v1/document/watermark`, `POST /api/v1/document/verify`

### 3. Physical ID Card Verification

QR-code-based ground truth verification for photographed physical ID cards, enhanced with Gemini-based visual reasoning.

- **Flow**: Extract QR Token → Fetch DB Record → Gemini-powered OCR Photograph → Cross-compare fields.
- **Endpoint**: `POST /api/v1/id/verify`

### 4. Review Credibility Scoring

Scores user reviews for authenticity using NLP and History Analysis.

- **Signals**: AI Detection (sentence structure) → Spam Detection (coordinated patterns) → Reviewer Trust History.
- **Endpoint**: `POST /api/v1/review/score`

### 5. Extension API Bridge (Zero-Config Scanner)

Dedicated proxy endpoint allowing the Credify Chrome Extension to run deep Gemini-based reviews without distributing API keys to end-users.

- **Flow**: Extract DOM Text → Batch Query Backend → Stream Classification Overlay.
- **Endpoint**: `POST /api/v1/extension/classify`

### 6. The Trust Database Showcase

A striking visualization of the cross-platform reputation index. Shows network node map mapping the user's trust history across multiple digital properties.

- **Features**: Live network topography, universal trust score halo, and global audit log detailing transactions and cross-shop score deltas.
- **Route**: `/trust-database`

---

## 🛠️ Maintenance & Theming Guide

To ensure Credify remains a first-class fraud prevention tool, all future development should adhere to these maintenance principles:

### **1. Keeping the "Dynamic Trust" Theme**

- Every new feature must answer: _"How does this affect the user's Unified Trust Score?"_
- Any verification route should always call the `trustProfile` utility to update scores based on outcomes.

### **2. Structure Consistency**

- **Frontend**: Use Next.js App router conventions. Components should be styled using vanilla CSS for max flexibility, leveraging the premium dashboard theme.
- **Backend**: Adhere to the `src/routes/...` pattern for feature isolation and `src/utils/...` for pure detection logic. Keep `server.js` clean and only used for orchestration.
- **Database**: Use **Drizzle ORM** for schema migrations in the `backend/` directory.

### **3. AI and Forensics Updates**

- C2PA / Content Credentials parsing lives in `utils/c2paAnalysis.js`, built on the official `@contentauth/c2pa-node`. It runs before the paid classifiers: a valid signed manifest declaring an AI `digitalSourceType` is conclusive. Update the source-type sets there as the C2PA spec evolves.
- AI models (Hive AI as the primary detector, Gemini as the fallback) should be abstracted in `utils/aiDetection.js`. If models are swapped or updated, only the utility should change, not the routes.
- EXIF extraction logic is kept in `utils/exifAnalysis.js`. Update this when adding support for newer phone metadata or more forensic signals.

### **4. Scaling Identity**

- Always prefer `Neon Auth` over custom auth solutions. The `profile-setup` logic is the entry point for all new "Partner" and "User" profiles.

---

## 📦 Tech Stack

| Layer         | Technology                             | Purpose                                     |
| ------------- | -------------------------------------- | ------------------------------------------- |
| **Frontend**  | Next.js / React (App Router) / Vanilla CSS | Management Dashboard, Trust DB Visualization |
| **Backend**   | Node.js / Express                      | Core API Engine & Forensics Orchestration   |
| **Database**  | Neon DB (Serverless Postgres)          | Trust DB, Hashed Records, Logs              |
| **Auth**      | Neon Auth                              | Identity Provider & Multi-tenant Access     |
| **Provenance**| `@contentauth/c2pa-node`               | Signed C2PA / Content Credentials parsing & validation |
| **Forensics** | Hive AI v3 (Gemini fallback)           | AI-generated Image & Deepfake Detection     |
| **Metadata**  | `exifr` + `jimp`                       | Forensic Analysis & Document Fingerprinting |
| **AI / OCR**  | Google Gemini API                      | Advanced OCR, NLP review scoring, ID data extraction |
| **Extension** | Chrome Extension (Manifest V3)         | Zero-config browser scanner for users       |

---

## 🗝️ Getting Started

### Prerequisites

- Node.js v22+ (required by `@contentauth/c2pa-node` for provenance parsing)
- Neon Project (Compute & Auth enabled)
- Hive AI API Key (`HIVE_API_KEY`, primary image forensics)
- Google Gemini API Key (`GEMINI_API_KEY`, OCR, review NLP, and AI-detection fallback)

### Installation

1.  **Env**: copy `.env.example` → `.env` and `backend/.env.example` → `backend/.env`;
    set the same `INTERNAL_API_SECRET` in both (the Next.js proxy and Express
    authenticate to each other with it — end users just sign in, no API keys).
2.  **Database**: `cd backend && npm install && npm run db:push && node src/db/seed.js`
3.  **Backend**: `npm run dev` (in `backend/`, port 3002)
4.  **Frontend**: `npm install && npm run dev` (in root, port 3000)

_Credify · v1.0 · Protect the Digital Truth · 2026_

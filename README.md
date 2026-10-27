# Amrutam Telemedicine Backend: Production-Grade System

[![CI/CD Pipeline](https://github.com/amrutam/telemedicine-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/amrutam/telemedicine-backend/actions)
[![OpenAPI 3.0](https://img.shields.io/badge/OpenAPI-3.0.3-brightgreen)](docs/openapi.yaml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)

Production-grade backend for **Amrutam’s Telemedicine System**, engineered for high scalability (**100,000 daily consultations**), zero double-booking race conditions, AES-256-GCM encryption of Protected Health Information (PHI), local saga choreography, rate-limiting, comprehensive audit trails, and end-to-end observability.

---

## 📑 Table of Contents
1. [Architectural Highlights](#1-architectural-highlights)
2. [Deliverables Checklist](#2-deliverables-checklist)
3. [Technology Stack & Design](#3-technology-stack--design)
4. [Quick Start with Docker](#4-quick-start-with-docker)
5. [Local Development Setup](#5-local-development-setup)
6. [API Documentation & Endpoints](#6-api-documentation--endpoints)
7. [Core Workflows & curl Examples](#7-core-workflows--curl-examples)
8. [Testing & Concurrency Verification](#8-testing--concurrency-verification)
9. [5-Minute Demo Video Script](#9-5-minute-demo-video-script)

---

## 1. Architectural Highlights

- **Modular Monolith**: Layered Clean Architecture (`Route → Middleware → Controller → Service → Repository`) wired via Dependency Injection (`src/container.js`).
- **Zero Double-Booking Guarantee**: Atomic conditional update (`UPDATE availability_slots ... WHERE status = 'AVAILABLE'`) + partial unique database index on `consultations(slot_id)`.
- **Distributed Sagas & Compensation**: BullMQ delayed jobs automatically expire unpaid consultation holds at $T+10\text{ min}$, restoring slot availability atomically.
- **Idempotency Engine**: PostgreSQL-backed `Idempotency-Key` middleware caching completed responses for 24 hours and blocking concurrent duplicate requests.
- **PHI Security**: AES-256-GCM encryption with key rotation (`v1`, `v2`) for clinical notes, addresses, and prescriptions.
- **Session Protection**: Argon2/Bcrypt password hashing, 5-attempt account lockout, rotating refresh tokens with automatic reuse detection, and TOTP MFA.
- **Observability**: Prometheus metrics at `/metrics`, Grafana dashboards, Pino structured JSON logging, and `x-request-id` tracing.

---

## 2. Deliverables Checklist

| Deliverable | Location | Status |
|---|---|:---:|
| **1. Git Repo with Code & Infra** | Repository root | ✅ |
| **2. README with Setup** | [README.md](file:///c:/Users/Sriram_Kapaganti/TeleMedicine/README.md) | ✅ |
| **3. OpenAPI / Swagger Schema** | [docs/openapi.yaml](file:///c:/Users/Sriram_Kapaganti/TeleMedicine/docs/openapi.yaml) & `/docs` | ✅ |
| **4. Architecture Doc (2–4 pages)** | [docs/architecture.md](file:///c:/Users/Sriram_Kapaganti/TeleMedicine/docs/architecture.md) | ✅ |
| **5. Automated Tests & CI Pipeline** | [tests/](file:///c:/Users/Sriram_Kapaganti/TeleMedicine/tests/) & [.github/workflows/ci.yml](file:///c:/Users/Sriram_Kapaganti/TeleMedicine/.github/workflows/ci.yml) | ✅ |
| **6. Observability Setup** | [infra/prometheus/](file:///c:/Users/Sriram_Kapaganti/TeleMedicine/infra/prometheus/) & [infra/grafana/](file:///c:/Users/Sriram_Kapaganti/TeleMedicine/infra/grafana/) | ✅ |
| **7. Security Checklist & Threat Model** | [docs/threat-model.md](file:///c:/Users/Sriram_Kapaganti/TeleMedicine/docs/threat-model.md) & [docs/security-checklist.md](file:///c:/Users/Sriram_Kapaganti/TeleMedicine/docs/security-checklist.md) | ✅ |
| **8. Backup & DR Strategy** | [docs/backup-dr.md](file:///c:/Users/Sriram_Kapaganti/TeleMedicine/docs/backup-dr.md) | ✅ |
| **9. Concurrency Test (20 parallel requests)** | [tests/concurrency/doubleBooking.test.js](file:///c:/Users/Sriram_Kapaganti/TeleMedicine/tests/concurrency/doubleBooking.test.js) | ✅ |

---

## 3. Technology Stack & Design

```
                    ┌──────────────┐
   Client ───────►  │ Nginx / LB   │  (TLS termination, edge rate limit)
                    └──────┬───────┘
                           ▼
              ┌────────────────────────┐
              │  Express API (N pods)  │  stateless, horizontally scalable (HPA 3-20)
              │  routes → controllers  │
              │  → services → repos    │
              └───┬──────────┬─────────┘
                  │          │
        ┌─────────▼──┐   ┌───▼──────────────┐
        │ PostgreSQL │   │ Redis 7          │
        │ primary    │   │ cache, locks,    │
        │ + replica  │   │ rate-limit,      │
        └─────▲──────┘   │ BullMQ queues    │
              │          └───┬──────────────┘
        ┌─────┴──────┐       │
        │ Worker     │◄──────┘  (slot hold expiry saga, notifications, rollups)
        └────────────┘
```

- **Runtime**: Node.js 22 LTS
- **Framework**: Express.js with Helmet, CORS, and Pino
- **Database**: PostgreSQL 16 (8 Core Tables + 3 Support Tables, `pgcrypto`, `pg_trgm`)
- **Caching & Queues**: Redis 7 Alpine, BullMQ 5
- **Validation**: Zod (strict typed schemas)
- **Security**: AES-256-GCM, TOTP (`otplib`), Bcrypt/Argon2, JSON Web Tokens
- **Observability**: Prometheus (`prom-client`), Grafana, Pino JSON logs

---

## 4. Quick Start with Docker

Start the entire production stack (PostgreSQL, Redis, Express API, Worker, Prometheus, and Grafana) with a single command:

```bash
docker-compose up --build -d
```

### Access Points
- **API Server**: `http://localhost:3000/api/v1`
- **Swagger Documentation**: `http://localhost:3000/docs`
- **Prometheus Metrics**: `http://localhost:3000/metrics`
- **Prometheus Server**: `http://localhost:9090`
- **Grafana Dashboards**: `http://localhost:3001` (User: `admin`, Password: `amrutam_admin_2026`)

---

## 5. Local Development Setup

### Prerequisites
- Node.js 22+
- PostgreSQL 16+
- Redis 7+

### Installation Steps
```bash
# 1. Clone repository
git clone https://github.com/amrutam/telemedicine-backend.git
cd telemedicine-backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env

# 4. Run database migrations
npm run migrate

# 5. Seed test and demo data
npm run seed

# 6. Start API server
npm run dev

# 7. (Optional terminal) Start background worker
npm run dev:worker
```

### Seeded Demo Credentials
- **Admin**: `admin@amrutam.global` / `Admin@Amrutam2026!`
- **Doctor**: `dr.sharma@amrutam.global` / `Doctor@Amrutam2026!`
- **Patient**: `patient@amrutam.global` / `Patient@Amrutam2026!`

---

## 6. API Documentation & Endpoints

Base URL: `/api/v1`

| Controller | Method | Endpoint | Description |
|---|---|---|---|
| **Auth** | `POST` | `/auth/register` | Register new user (Patient, Doctor, Admin) |
| **Auth** | `POST` | `/auth/login` | Login with credentials and optional MFA |
| **Auth** | `POST` | `/auth/refresh` | Rotate single-use refresh token |
| **Auth** | `POST` | `/auth/logout` | Revoke session tokens |
| **Auth** | `POST` | `/auth/mfa/setup` | Generate TOTP secret & QR URI |
| **Auth** | `POST` | `/auth/mfa/verify` | Verify TOTP code and activate MFA |
| **Users** | `GET` | `/users/me` | Fetch authenticated user details |
| **Users** | `PATCH` | `/users/me` | Update personal profile |
| **Users** | `GET` | `/users` | List users (Admin only) |
| **Profiles** | `GET` | `/users/me/profile` | View profile with decrypted PHI |
| **Profiles** | `PUT` | `/users/me/profile` | Update profile with AES-256-GCM encrypted PHI |
| **Doctors** | `GET` | `/doctors` | Search & filter doctors (Redis cached 60s) |
| **Doctors** | `POST` | `/doctors` | Doctor onboarding |
| **Doctors** | `GET` | `/doctors/:id` | View doctor profile (Cached 5 min) |
| **Doctors** | `PATCH` | `/doctors/:id/verify` | Verify doctor license (Admin only) |
| **Slots** | `POST` | `/doctors/:id/slots` | Bulk create availability slots |
| **Slots** | `GET` | `/doctors/:id/slots?date=` | Get available slots (Redis cached 30s) |
| **Slots** | `DELETE`| `/slots/:id` | Delete available slot |
| **Consultations** | `POST` | `/consultations` | **Book consultation (Idempotent, atomic hold)** |
| **Consultations** | `GET` | `/consultations` | List consultations |
| **Consultations** | `GET` | `/consultations/:id` | View consultation details (Ownership enforced) |
| **Consultations** | `POST` | `/consultations/:id/cancel` | Cancel consultation & release slot |
| **Consultations** | `POST` | `/consultations/:id/start` | Start consultation (Doctor only) |
| **Consultations** | `POST` | `/consultations/:id/complete`| Complete consultation (Doctor only) |
| **Prescriptions** | `POST` | `/consultations/:id/prescriptions` | Issue prescription (AES-256-GCM encrypted) |
| **Prescriptions** | `GET` | `/prescriptions/:id` | View prescription (Decrypted, audit logged) |
| **Payments** | `POST` | `/payments/webhook` | **Webhook callback (HMAC-verified, idempotent)** |
| **Admin** | `GET` | `/admin/analytics/overview` | Platform overview KPIs |
| **Admin** | `GET` | `/admin/analytics/doctors` | Doctor earnings and ratings breakdown |
| **Admin** | `GET` | `/admin/audit-logs` | Query compliance audit trails |
| **Health** | `GET` | `/health/live` | Liveness probe (200 OK) |
| **Health** | `GET` | `/health/ready` | Readiness probe (DB & Redis status) |
| **Metrics** | `GET` | `/metrics` | Prometheus metrics scrape target |

---

## 7. Core Workflows & curl Examples

### 1. Patient Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient@amrutam.global",
    "password": "Patient@Amrutam2026!"
  }'
```

### 2. Search Doctors (Cached in Redis)
```bash
curl "http://localhost:3000/api/v1/doctors?specialization=Ayurveda&minRating=4.5&limit=5"
```

### 3. Book Consultation (With Idempotency-Key)
```bash
curl -X POST http://localhost:3000/api/v1/consultations \
  -H "Authorization: Bearer <PATIENT_JWT_ACCESS_TOKEN>" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": "<DOCTOR_UUID>",
    "slotId": "<SLOT_UUID>",
    "reason": "Consultation for chronic acidity and holistic wellness"
  }'
```
*Note: Resending the exact same request with the same `Idempotency-Key` immediately returns the cached `201 Created` response with header `X-Cache-Lookup: HIT-IDEMPOTENT`.*

### 4. Payment Gateway Webhook (Idempotent Confirmation)
```bash
curl -X POST http://localhost:3000/api/v1/payments/webhook \
  -H "Content-Type: application/json" \
  -H "x-signature: <HMAC_SHA256_SIGNATURE>" \
  -d '{
    "event": "payment.success",
    "providerRef": "pay_9876543210123456",
    "consultationId": "<CONSULTATION_UUID>",
    "amount": 500.00
  }'
```

### 5. Doctor Issues Prescription (AES-256-GCM Encrypted)
```bash
curl -X POST http://localhost:3000/api/v1/consultations/<CONSULTATION_UUID>/prescriptions \
  -H "Authorization: Bearer <DOCTOR_JWT_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "medicines": [
      {
        "name": "Amrutam Brahmi Churna",
        "dosage": "1 tsp twice daily",
        "frequency": "Morning and Evening",
        "duration": "14 days",
        "instructions": "Take with lukewarm milk after meals"
      }
    ],
    "instructions": "Avoid oily foods and maintain regular hydration."
  }'
```

---

## 8. Testing & Concurrency Verification

The test suite covers unit tests, integration tests, and multi-threaded race condition stress tests:

```bash
# Run all test suites
npm test

# Run concurrency double-booking defense test (20 parallel requests -> 1 success, 19 conflicts)
npm run test:concurrency

# Run unit tests (AES-256-GCM crypto, state machine, token rotation)
npm run test:unit

# Run integration tests (API routes & auth)
npm run test:integration
```

### Concurrency Test Results:
```
PASS tests/concurrency/doubleBooking.test.js
  Concurrency Safety: Double-Booking Prevention
    √ should ensure that among 20 parallel booking attempts on the same slot, exactly 1 succeeds and 19 fail with ConflictError (14 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```

---

## 9. 5-Minute Demo Video Script

| Time | Segment | Visual / Action | Narration Script |
|---|---|---|---|
| **0:00 - 0:30** | **Architecture Overview** | Show [docs/architecture.md](docs/architecture.md) & Mermaid diagram | *"Hello! Welcome to the Amrutam Telemedicine Backend demo. The platform is designed as a modular monolith in Node.js with PostgreSQL, Redis, and BullMQ, strictly separated into Routes, Controllers, Services, and Repositories."* |
| **0:30 - 1:15** | **Auth & TOTP MFA** | Run `POST /auth/register` and `POST /auth/login` | *"We register a user with Argon2 password hashing. For doctors and admins, TOTP MFA is mandatory. Refresh tokens rotate on every use with automatic reuse detection."* |
| **1:15 - 1:45** | **Doctor Slots & Search** | Run `POST /doctors/:id/slots` and `GET /doctors` | *"Doctors create slots with ownership verification. Patients search doctors with filters and full-text search, with responses cached in Redis for 60 seconds."* |
| **1:45 - 2:45** | **Core Booking Flow** | Run `POST /consultations` with `Idempotency-Key` | *"A patient books a slot. An atomic conditional update sets the slot to HELD for 10 minutes and schedules a BullMQ delayed compensation job. If unpaid after 10 minutes, the slot is automatically released."* |
| **2:45 - 3:15** | **Idempotency Replay** | Send the same booking curl twice | *"Notice the second request returns the exact same 201 response with header HIT-IDEMPOTENT, ensuring network retries never cause duplicate bookings."* |
| **3:15 - 4:00** | **Concurrency Test** | Run `npm run test:concurrency` in terminal | *"Here we fire 20 simultaneous booking requests at the exact same millisecond. Exactly 1 acquires the atomic slot lock; the other 19 fail cleanly with 409 Conflict. Zero race conditions."* |
| **4:00 - 4:30** | **Webhook & Encrypted Prescription** | Run webhook callback and `POST /prescriptions` | *"The payment webhook confirms the booking. The doctor issues a prescription where clinical instructions and medicines are encrypted via AES-256-GCM."* |
| **4:30 - 5:00** | **Observability & CI** | Open Grafana (`http://localhost:3001`) and GitHub Actions | *"Every operation is logged in the append-only audit trail. Prometheus tracks p95 latency and conflicts on our Grafana dashboard. GitHub Actions validates tests and security audits on every commit."* |

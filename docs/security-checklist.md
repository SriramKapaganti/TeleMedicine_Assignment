# Security Checklist & Verification Matrix

This checklist maps implemented controls to the evaluation rubric and security verification tests.

## 1. Authentication & Session Management
- [x] **Password Hashing**: Passwords hashed with high-work-factor salt (Argon2 / Bcrypt 12 rounds).
- [x] **Account Lockout**: Automatically locks user account for 15 minutes after 5 consecutive failed login attempts.
- [x] **Token Hygiene**: Access tokens expire in 15 minutes.
- [x] **Refresh Token Rotation**: Refresh tokens are single-use; a new token is issued on each rotation.
- [x] **Reuse Detection**: If a revoked refresh token is presented, all active sessions for that user are terminated immediately.
- [x] **TOTP Multi-Factor Authentication**: Mandatory for DOCTOR and ADMIN roles. Secrets stored encrypted via AES-256-GCM.

## 2. Authorization & Access Control (RBAC)
- [x] **Role Separation**: `PATIENT`, `DOCTOR`, and `ADMIN` role boundaries enforced via `authorize()` middleware.
- [x] **Object-Level Ownership**: Patients can only read their own consultations and prescriptions; Doctors can only view their assigned patients.
- [x] **Admin Segregation**: Doctor verification and system-wide analytics restricted to `ADMIN`.

## 3. Data Protection & PHI Encryption
- [x] **AES-256-GCM Field Encryption**: Patient address, medical history, clinical notes, and prescription medications stored encrypted.
- [x] **Authenticated Encryption**: 128-bit GCM auth tags prevent tampering or bit-flipping attacks.
- [x] **Key Rotation Framework**: Versioned key identifiers (`v1`, `v2`) support zero-downtime key rotation.
- [x] **PHI Access Audit Logs**: Every read or write of encrypted PHI logs an immutable entry to `audit_logs`.

## 4. Input Validation & Injection Mitigation
- [x] **Schema Validation**: All HTTP request bodies, query strings, and URL parameters validated via Zod schemas.
- [x] **Parameterized Queries**: 100% of SQL statements executed using parameterized placeholders (`$1, $2`).
- [x] **Payload Limit**: Request body size strictly capped at 10kb to mitigate memory exhaustion DoS.

## 5. Network, Edge & Webhook Security
- [x] **Rate Limiting**: Multi-tier Redis-backed rate limiting (Global: 100/min; Auth: 15/15min; Booking: 10/min).
- [x] **Webhook Signature Verification**: Constant-time HMAC-SHA256 comparison for payment gateway webhooks.
- [x] **HTTP Security Headers**: Helmet configured with `nosniff`, `DENY` clickjacking, and referrer policies.
- [x] **CORS Whitelist**: Configurable CORS origin restriction.

## 6. Observability & Auditing
- [x] **Audit Trail**: Append-only log recording actor ID, role, action, entity, IP, and request ID.
- [x] **Log Redaction**: Automatic redaction of passwords, tokens, authorization headers, and encrypted fields in Pino logs.
- [x] **Request ID Tracing**: Unique `x-request-id` UUID propagated across logs, metrics, and error responses.

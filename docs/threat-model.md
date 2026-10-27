# Amrutam Telemedicine Backend: Security & Threat Model

## 1. Executive Security Summary

Telemedicine applications process highly sensitive Protected Health Information (PHI), medical prescriptions, and financial transactions. This document outlines the threat modeling framework, attack surface analysis, OWASP Top 10 mitigations, data classification, and cryptographic key management policies.

---

## 2. Data Classification Matrix

| Data Tier | Examples | Storage Standard | Access Control | Encryption at Rest |
|---|---|---|---|---|
| **Tier 1: PHI (Protected Health Information)** | Medical history, doctor notes, prescription medicines, patient addresses | PostgreSQL | Strict Patient/Doctor/Admin ownership | **AES-256-GCM** with key versioning |
| **Tier 2: Authentication & Secrets** | Passwords, TOTP MFA secrets, JWT refresh tokens, webhook HMAC secrets | PostgreSQL / Vault | Internal Auth service only | **Argon2 / SHA-256 / AES-256-GCM** |
| **Tier 3: Confidential Business Data** | Consultation billing, payment provider references, doctor license IDs | PostgreSQL | Role-Based Access Control | TLS 1.3 / DB disk encryption |
| **Tier 4: Public Data** | Doctor specialization, verified status, general bio, slot times | PostgreSQL / Redis | Public Read | Standard storage |

---

## 3. Cryptographic Design & Key Rotation

### PHI Encryption Standard
All sensitive health fields (`address_enc`, `medical_history_enc`, `notes_enc`, `medicines_enc`, `instructions_enc`) are encrypted using **AES-256-GCM (Galois/Counter Mode)**. GCM provides both confidentiality and built-in cryptographic integrity authentication via a 128-bit authentication tag.

### Ciphertext Envelope Format
Payloads are formatted as a colon-delimited string containing key versioning:
$$\text{Envelope} = \langle\text{version}\rangle:\langle\text{iv\_hex}\rangle:\langle\text{authTag\_hex}\rangle:\langle\text{ciphertext\_hex}\rangle$$

### Key Rotation Strategy
1. The active encryption key is declared via `ENCRYPTION_KEY_CURRENT_VERSION` (e.g. `v1`).
2. Legacy keys (`ENCRYPTION_KEY_V1`, `ENCRYPTION_KEY_V2`) are maintained in the environment key ring.
3. On write operations, the current version is applied.
4. On read operations, `decrypt()` inspects the version prefix to pick the correct key.
5. A background re-encryption worker can lazily re-encrypt older records to the current version without downtime.

---

## 4. STRIDE Threat Model

| Category | Threat Identified | Impact | Implemented Mitigation |
|---|---|---|---|
| **Spoofing** | Attacker impersonating patient or doctor | Unauthorized medical access | Short-lived JWT (15 min), SHA-256 hashed rotating refresh tokens, TOTP MFA for doctors/admins |
| **Tampering** | Modifying prescription or consultation data in transit or database | Patient harm, clinical error | TLS 1.3 in transit; AES-256-GCM authenticated tags detect tampering at rest |
| **Repudiation** | Doctor denies issuing prescription or patient denies booking | Legal liability, compliance breach | Append-only `audit_logs` capturing actor, action, timestamp, IP, and request ID |
| **Information Disclosure** | Leakage of medical history or prescriptions in logs or errors | HIPAA/GDPR non-compliance | Pino structured logging with strict redaction paths; sanitized error responses |
| **Denial of Service** | Volumetric brute force or rapid slot exhaustion | System unavailability | Global rate limiter (100 req/min), Auth limiter (15 req/15 min), 10kb body size limits |
| **Elevation of Privilege** | Patient executing admin analytics or doctor slot creation | Data breach | Strict RBAC middleware (`authorize('DOCTOR')`) and service-layer ownership checks |

---

## 5. OWASP Top 10 (2021) Mitigation Matrix

### A01: Broken Access Control
- **Risk**: Patient inspecting another patient's consultation or prescription.
- **Mitigation**: Implemented dual-layer checks: Route-level RBAC (`authorize`) combined with Service-level ownership validation (`consultation.patient_id === currentUser.id`).

### A02: Cryptographic Failures
- **Risk**: Cleartext exposure of health diagnoses or password exposure.
- **Mitigation**: Passwords hashed using salted Argon2/Bcrypt; all PHI encrypted via AES-256-GCM; TLS enforced at Nginx edge.

### A03: Injection
- **Risk**: SQL injection in doctor search or booking transactions.
- **Mitigation**: Strict parameterized queries (`$1, $2`) using the `pg` driver; zero string concatenation. All HTTP inputs sanitized through Zod schemas.

### A04: Insecure Design
- **Risk**: Double-booking race condition causing concurrent slot allocations.
- **Mitigation**: Atomic conditional update (`WHERE status = 'AVAILABLE'`) with unique partial index on `consultations(slot_id)`.

### A05: Security Misconfiguration
- **Risk**: Leaking stack traces or default server headers.
- **Mitigation**: Helmet security headers configured; stack traces suppressed in production error responses; unprivileged `node` user in Docker.

### A07: Identification and Authentication Failures
- **Risk**: Credential stuffing and token replay attacks.
- **Mitigation**: Account lockout after 5 consecutive failed attempts (15-minute lock); refresh token rotation with immediate revocation upon reuse detection.

### A08: Software and Data Integrity Failures
- **Risk**: Unverified payment webhook callbacks faking payment success.
- **Mitigation**: Constant-time HMAC-SHA256 signature verification (`x-signature`) on all webhook endpoints.

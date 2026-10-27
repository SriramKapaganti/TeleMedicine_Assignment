-- Migration 002: Users, Profiles, and Doctors Tables

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'PATIENT',
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret_enc TEXT,
    status user_status NOT NULL DEFAULT 'ACTIVE',
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    dob DATE,
    gender VARCHAR(50),
    address_enc TEXT,
    medical_history_enc TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    specialization VARCHAR(100) NOT NULL,
    license_no VARCHAR(100) NOT NULL UNIQUE,
    experience_yrs INT NOT NULL DEFAULT 0,
    consultation_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

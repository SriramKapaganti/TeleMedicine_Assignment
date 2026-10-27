-- Migration 001: Extensions and ENUM Types
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('ACTIVE', 'LOCKED', 'SUSPENDED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'slot_status') THEN
        CREATE TYPE slot_status AS ENUM ('AVAILABLE', 'HELD', 'BOOKED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consultation_status') THEN
        CREATE TYPE consultation_status AS ENUM (
            'PENDING_PAYMENT',
            'CONFIRMED',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED',
            'EXPIRED',
            'NO_SHOW'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('INITIATED', 'SUCCESS', 'FAILED', 'REFUNDED');
    END IF;
END $$;

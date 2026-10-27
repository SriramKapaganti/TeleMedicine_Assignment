-- Migration 003: Availability Slots and Consultations

CREATE TABLE IF NOT EXISTS availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status slot_status NOT NULL DEFAULT 'AVAILABLE',
    held_until TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_doctor_slot UNIQUE (doctor_id, start_time),
    CONSTRAINT chk_slot_time CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    slot_id UUID NOT NULL REFERENCES availability_slots(id) ON DELETE RESTRICT,
    status consultation_status NOT NULL DEFAULT 'PENDING_PAYMENT',
    reason TEXT,
    notes_enc TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crucial partial unique index: ensures no two active/confirmed consultations can ever share the same slot!
CREATE UNIQUE INDEX IF NOT EXISTS uq_consultation_active_slot 
ON consultations (slot_id) 
WHERE status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED');

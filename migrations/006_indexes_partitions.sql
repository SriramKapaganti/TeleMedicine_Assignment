-- Migration 006: Performance Indexes & Trigram Search

-- Slots lookup index: doctor_id + start_time where status is AVAILABLE
CREATE INDEX IF NOT EXISTS idx_slots_doc_start 
ON availability_slots (doctor_id, start_time) 
WHERE status = 'AVAILABLE';

-- Consultation lookups by patient and doctor
CREATE INDEX IF NOT EXISTS idx_consultations_patient 
ON consultations (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consultations_doctor 
ON consultations (doctor_id, created_at DESC);

-- Doctor search and filtering
CREATE INDEX IF NOT EXISTS idx_doctors_specialization 
ON doctors (specialization);

CREATE INDEX IF NOT EXISTS idx_doctors_rating_fee 
ON doctors (rating_avg DESC, consultation_fee ASC);

-- Trigram fuzzy search on doctor full_name (via profiles)
CREATE INDEX IF NOT EXISTS idx_profiles_fullname_trgm 
ON profiles USING gin (full_name gin_trgm_ops);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor 
ON audit_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
ON audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
ON audit_logs (created_at DESC);

-- Idempotency key lookup & expiry
CREATE INDEX IF NOT EXISTS idx_idempotency_expires 
ON idempotency_keys (expires_at);

-- Refresh token lookup
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user 
ON refresh_tokens (user_id);

'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const { hashPassword } = require('../src/utils/password');
const { encrypt } = require('../src/utils/crypto');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'amrutam_db',
      user: process.env.DB_USER || 'amrutam_user',
      password: process.env.DB_PASSWORD || 'amrutam_secure_password_2026',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    });

async function seed() {
  console.log('[SEED] Connecting to database...');
  const client = await pool.connect();
  try {
    console.log('[SEED] Connected. Seeding database with initial test data...');
    await client.query('BEGIN');

    // 1. Specializations
    const specializations = [
      'Ayurveda General Medicine',
      'Kayachikitsa (Internal Medicine)',
      'Panchakarma',
      'Shalya Tantra (Surgery)',
      'Prasuti & Stri Roga (Gynecology)',
      'Kaumarbhritya (Pediatrics)',
    ];

    for (const spec of specializations) {
      await client.query(
        `INSERT INTO specializations (name, description)
         VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING`,
        [spec, `Ayurvedic specialty in ${spec}`]
      );
    }

    // 2. Default Admin
    const adminPassHash = await hashPassword('Admin@Amrutam2026!');
    const adminRes = await client.query(
      `INSERT INTO users (email, phone, password_hash, role, status)
       VALUES ('admin@amrutam.global', '+919876543210', $1, 'ADMIN', 'ACTIVE')
       ON CONFLICT (email) DO UPDATE SET password_hash = $1
       RETURNING id`,
      [adminPassHash]
    );
    const adminId = adminRes.rows[0].id;

    await client.query(
      `INSERT INTO profiles (user_id, full_name)
       VALUES ($1, 'System Administrator')
       ON CONFLICT (user_id) DO NOTHING`,
      [adminId]
    );

    // 3. Default Doctor
    const docPassHash = await hashPassword('Doctor@Amrutam2026!');
    const docRes = await client.query(
      `INSERT INTO users (email, phone, password_hash, role, status)
       VALUES ('dr.sharma@amrutam.global', '+919876543211', $1, 'DOCTOR', 'ACTIVE')
       ON CONFLICT (email) DO UPDATE SET password_hash = $1
       RETURNING id`,
      [docPassHash]
    );
    const doctorUserId = docRes.rows[0].id;

    await client.query(
      `INSERT INTO profiles (user_id, full_name, gender)
       VALUES ($1, 'Dr. Rajesh Sharma', 'MALE')
       ON CONFLICT (user_id) DO NOTHING`,
      [doctorUserId]
    );

    const docRecordRes = await client.query(
      `INSERT INTO doctors (user_id, specialization, license_no, experience_yrs, consultation_fee, rating_avg, is_verified, bio)
       VALUES ($1, 'Ayurveda General Medicine', 'AYUR-MED-9921', 12, 500.00, 4.95, TRUE, 'Senior Ayurvedic practitioner with 12+ years of holistic healing experience.')
       ON CONFLICT (license_no) DO UPDATE SET consultation_fee = 500.00
       RETURNING id`,
      [doctorUserId]
    );
    const doctorId = docRecordRes.rows[0].id;

    // 4. Availability slots for Doctor
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const slots = [
      { start: `${dateStr}T09:00:00Z`, end: `${dateStr}T09:30:00Z` },
      { start: `${dateStr}T10:00:00Z`, end: `${dateStr}T10:30:00Z` },
      { start: `${dateStr}T11:00:00Z`, end: `${dateStr}T11:30:00Z` },
      { start: `${dateStr}T14:00:00Z`, end: `${dateStr}T14:30:00Z` },
      { start: `${dateStr}T15:00:00Z`, end: `${dateStr}T15:30:00Z` },
    ];

    for (const slot of slots) {
      await client.query(
        `INSERT INTO availability_slots (doctor_id, start_time, end_time, status)
         VALUES ($1, $2, $3, 'AVAILABLE')
         ON CONFLICT (doctor_id, start_time) DO NOTHING`,
        [doctorId, slot.start, slot.end]
      );
    }

    // 5. Default Patient
    const patPassHash = await hashPassword('Patient@Amrutam2026!');
    const patRes = await client.query(
      `INSERT INTO users (email, phone, password_hash, role, status)
       VALUES ('patient@amrutam.global', '+919876543212', $1, 'PATIENT', 'ACTIVE')
       ON CONFLICT (email) DO UPDATE SET password_hash = $1
       RETURNING id`,
      [patPassHash]
    );
    const patientId = patRes.rows[0].id;

    const encryptedAddress = encrypt('123 Green Valley Road, Indiranagar, Bengaluru, India');
    const encryptedHistory = encrypt({ allergies: ['Penicillin'], chronicConditions: ['Mild Asthma'] });

    await client.query(
      `INSERT INTO profiles (user_id, full_name, dob, gender, address_enc, medical_history_enc)
       VALUES ($1, 'Aarav Patel', '1992-05-15', 'MALE', $2, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [patientId, encryptedAddress, encryptedHistory]
    );

    await client.query('COMMIT');
    console.log('[SEED] Seeding completed successfully.');
    console.log('--- DEMO CREDENTIALS ---');
    console.log('Admin:   admin@amrutam.global / Admin@Amrutam2026!');
    console.log('Doctor:  dr.sharma@amrutam.global / Doctor@Amrutam2026!');
    console.log('Patient: patient@amrutam.global / Patient@Amrutam2026!');
    console.log('------------------------');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SEED ERROR]', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seed };

'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'amrutam_db',
  user: process.env.DB_USER || 'amrutam_user',
  password: process.env.DB_PASSWORD || 'amrutam_secure_password_2026',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('[MIGRATE] Connected to PostgreSQL. Ensuring migrations table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const alreadyApplied = await client.query(
        'SELECT 1 FROM _migrations WHERE filename = $1',
        [file]
      );

      if (alreadyApplied.rowCount > 0) {
        console.log(`[MIGRATE] Skipping already applied: ${file}`);
        continue;
      }

      console.log(`[MIGRATE] Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[MIGRATE] Successfully applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[MIGRATE] Failed to apply ${file}:`, err);
        throw err;
      }
    }

    console.log('[MIGRATE] All migrations applied successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[MIGRATE ERROR]', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };

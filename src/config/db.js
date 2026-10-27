'use strict';

const { Pool } = require('pg');
const config = require('./index');
const logger = require('./logger');

const pool = config.DATABASE_URL
  ? new Pool({
      connectionString: config.DATABASE_URL,
      min: config.DB_POOL_MIN,
      max: config.DB_POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.DB_NAME,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      min: config.DB_POOL_MIN,
      max: config.DB_POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: config.DB_SSL ? { rejectUnauthorized: false } : false,
    });

pool.on('error', (err) => {
  logger.error({ err }, '[DATABASE] Unexpected error on idle client');
});

pool.on('connect', () => {
  logger.debug('[DATABASE] Client connected to pool');
});

/**
 * Health check ping for database
 */
async function checkDbHealth() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT 1 as healthy, NOW() as current_time');
    return res.rows[0];
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  checkDbHealth,
};

'use strict';

const { pool } = require('../config/db');
const logger = require('../config/logger');

async function processAnalyticsRollup(job) {
  logger.info('[ANALYTICS_ROLLUP] Running daily analytics aggregation...');
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_consultations,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
        COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled,
        COUNT(*) FILTER (WHERE status = 'EXPIRED') as expired
      FROM consultations
    `);
    logger.info({ stats: stats.rows[0] }, '[ANALYTICS_ROLLUP] Completed rollup');
    return stats.rows[0];
  } catch (err) {
    logger.error({ err }, '[ANALYTICS_ROLLUP] Aggregation error');
    throw err;
  }
}

module.exports = { processAnalyticsRollup };

'use strict';

const { withRetry } = require('./retry');

/**
 * Execute a callback within an isolated PostgreSQL transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 * Integrates with withRetry for serializable transaction safety.
 *
 * @param {import('pg').Pool} pool - Database pool
 * @param {Function} callback - Function receiving (client) => Promise<any>
 * @param {object} [options]
 * @param {string} [options.isolationLevel='READ COMMITTED']
 * @returns {Promise<any>}
 */
async function withTransaction(pool, callback, options = {}) {
  const { isolationLevel = 'READ COMMITTED' } = options;

  return withRetry(async () => {
    const client = await pool.connect();
    try {
      await client.query(`BEGIN TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        // Log or suppress rollback error
      }
      throw err;
    } finally {
      client.release();
    }
  });
}

module.exports = { withTransaction };

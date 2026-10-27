'use strict';

/**
 * Executes an async operation with exponential backoff and full jitter.
 * Specifically targets PostgreSQL concurrency error codes:
 * 40001 (serialization_failure) and 40P01 (deadlock_detected).
 *
 * @param {Function} fn - Async function returning a promise
 * @param {object} options
 * @param {number} [options.maxRetries=3]
 * @param {number} [options.initialDelayMs=100]
 * @param {number} [options.maxDelayMs=2000]
 * @param {Function} [options.shouldRetry]
 * @returns {Promise<any>}
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 2000,
    shouldRetry = (err) => {
      // 40001: serialization failure, 40P01: deadlock detected
      return err && (err.code === '40001' || err.code === '40P01' || err.message?.includes('deadlock'));
    },
  } = options;

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries || !shouldRetry(err)) {
        throw err;
      }

      // Calculate exponential backoff with full jitter
      const expDelay = Math.min(maxDelayMs, initialDelayMs * Math.pow(2, attempt - 1));
      const jitteredDelay = Math.floor(Math.random() * expDelay);

      await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
    }
  }
}

module.exports = { withRetry };

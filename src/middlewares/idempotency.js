'use strict';

const crypto = require('crypto');
const { pool } = require('../config/db');
const { ConflictError, BadRequestError } = require('../utils/errors');
const { idempotencyReplaysTotal } = require('./metrics');
const logger = require('../config/logger');

/**
 * Creates hash of request method, path, and body.
 */
function computeRequestHash(req) {
  const payload = JSON.stringify({
    method: req.method,
    url: req.originalUrl || req.url,
    body: req.body || {},
    userId: req.user ? req.user.id : null,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Idempotency middleware for mutating requests.
 * @param {object} options
 * @param {boolean} [options.required=false] - Whether header is mandatory
 * @param {number} [options.ttlHours=24] - Retention for idempotency response
 */
function idempotency(options = { required: false, ttlHours: 24 }) {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    if (!key) {
      if (options.required) {
        return next(new BadRequestError('Idempotency-Key header is required for this operation'));
      }
      return next();
    }

    const requestHash = computeRequestHash(req);
    const userId = req.user ? req.user.id : null;
    const expiresAt = new Date(Date.now() + options.ttlHours * 3600 * 1000);

    let client;
    try {
      client = await pool.connect();

      // Check if key already exists
      const existing = await client.query(
        'SELECT * FROM idempotency_keys WHERE key = $1',
        [key]
      );

      if (existing.rowCount > 0) {
        const record = existing.rows[0];

        // Mismatch check: key reused for different payload
        if (record.request_hash !== requestHash) {
          client.release();
          return next(
            new ConflictError('Idempotency key reuse detected with different request parameters')
          );
        }

        // Concurrent in-flight request
        if (!record.status_code) {
          client.release();
          return next(
            new ConflictError('A request with this Idempotency-Key is currently in progress')
          );
        }

        // Return cached response!
        client.release();
        idempotencyReplaysTotal.inc();
        res.setHeader('X-Cache-Lookup', 'HIT-IDEMPOTENT');
        res.setHeader('Idempotency-Key', key);
        return res.status(record.status_code).json(record.response_body);
      }

      // Reserve key (lock)
      await client.query(
        `INSERT INTO idempotency_keys (key, user_id, request_hash, status_code, response_body, expires_at)
         VALUES ($1, $2, $3, NULL, NULL, $4)`,
        [key, userId, requestHash, expiresAt]
      );
      client.release();
      client = null;

      // Intercept response to save final status and body
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      res.json = function (body) {
        saveIdempotentResponse(key, res.statusCode, body).catch((err) => {
          logger.error({ err, key }, '[IDEMPOTENCY] Failed to save response');
        });
        return originalJson(body);
      };

      res.send = function (body) {
        let parsed = body;
        try {
          parsed = JSON.parse(body);
        } catch {}
        saveIdempotentResponse(key, res.statusCode, parsed).catch((err) => {
          logger.error({ err, key }, '[IDEMPOTENCY] Failed to save send response');
        });
        return originalSend(body);
      };

      next();
    } catch (err) {
      if (client) client.release();
      if (err.code === '23505') {
        // Unique violation (concurrent insert race)
        return next(new ConflictError('Concurrent request with this Idempotency-Key detected'));
      }
      next(err);
    }
  };
}

async function saveIdempotentResponse(key, statusCode, responseBody) {
  try {
    await pool.query(
      `UPDATE idempotency_keys 
       SET status_code = $1, response_body = $2 
       WHERE key = $3`,
      [statusCode, JSON.stringify(responseBody), key]
    );
  } catch (err) {
    logger.error({ err, key }, '[IDEMPOTENCY] Error persisting response');
  }
}

module.exports = idempotency;

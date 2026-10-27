'use strict';

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { redisClient } = require('../config/redis');

function createLimiter({ windowMs, max, message, keyGenerator }) {
  const options = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'error',
      code: 'TOO_MANY_REQUESTS',
      message: message || 'Too many requests, please try again later.',
    },
  };

  if (keyGenerator) {
    options.keyGenerator = keyGenerator;
  }

  if (redisClient && redisClient.status === 'ready') {
    try {
      options.store = new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: 'rl:',
      });
    } catch {
      // Fallback to in-memory store
    }
  }

  return rateLimit(options);
}

// 1. Global Limiter: 100 req/min per IP
const globalLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Global rate limit exceeded. Please wait a minute.',
});

// 2. Auth Limiter: 10 req/15 min per IP for brute-force protection
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

// 3. Booking Limiter: 10 req/min per user
const bookingLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many booking requests. Please wait a minute before trying again.',
  keyGenerator: (req) => (req.user ? req.user.id : req.ip),
});

module.exports = {
  globalLimiter,
  authLimiter,
  bookingLimiter,
};

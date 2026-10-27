'use strict';

const Redis = require('ioredis');
const config = require('./index');
const logger = require('./logger');
const { cacheService } = require('../utils/cache');

let redisClient = null;

const isTls = config.REDIS_TLS || (config.REDIS_URL && config.REDIS_URL.startsWith('rediss://'));
const tlsOptions = isTls ? { rejectUnauthorized: false } : undefined;

const baseOptions = {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: true,
  lazyConnect: config.NODE_ENV === 'test',
  connectTimeout: 10000,
  retryStrategy(times) {
    if (config.NODE_ENV === 'test' || times > 5) {
      return null;
    }
    return Math.min(times * 150, 3000);
  },
  ...(tlsOptions ? { tls: tlsOptions } : {}),
};

const redisOptions = config.REDIS_URL
  ? {
      ...baseOptions,
      url: config.REDIS_URL,
    }
  : {
      ...baseOptions,
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD || undefined,
      db: config.REDIS_DB,
    };

if (config.NODE_ENV !== 'test') {
  try {
    if (config.REDIS_URL) {
      redisClient = new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: null,
        connectTimeout: 10000,
        retryStrategy: redisOptions.retryStrategy,
        ...(tlsOptions ? { tls: tlsOptions } : {}),
      });
    } else {
      redisClient = new Redis(redisOptions);
    }

    redisClient.on('connect', () => {
      logger.info('[REDIS] Connected successfully');
    });

    redisClient.on('ready', () => {
      logger.info('[REDIS] Ready to accept commands');
      cacheService.setClient(redisClient);
    });

    redisClient.on('error', (err) => {
      logger.warn({ err: err.message }, '[REDIS] Connection error (using in-memory fallback)');
    });
  } catch (err) {
    logger.warn({ err }, '[REDIS] Failed to initialize Redis client. Memory fallback will be used.');
  }
}

async function checkRedisHealth() {
  if (!redisClient || redisClient.status !== 'ready') {
    return { status: 'fallback_memory', ready: false };
  }
  try {
    const pong = await redisClient.ping();
    return { status: pong === 'PONG' ? 'healthy' : 'degraded', ready: pong === 'PONG' };
  } catch (err) {
    return { status: 'error', error: err.message, ready: false };
  }
}

module.exports = {
  redisClient,
  redisOptions,
  checkRedisHealth,
};

'use strict';

const Redis = require('ioredis');
const config = require('./index');
const logger = require('./logger');
const { cacheService } = require('../utils/cache');

let redisClient = null;

const redisOptions = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD || undefined,
  db: config.REDIS_DB,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: true,
  lazyConnect: config.NODE_ENV === 'test',
  connectTimeout: 2000,
  retryStrategy(times) {
    if (config.NODE_ENV === 'test' || times > 3) {
      return null;
    }
    return Math.min(times * 100, 2000);
  },
};

if (config.NODE_ENV !== 'test') {
  try {
    redisClient = new Redis(redisOptions);

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
  const pong = await redisClient.ping();
  return { status: pong === 'PONG' ? 'healthy' : 'degraded', ready: pong === 'PONG' };
}

module.exports = {
  redisClient,
  redisOptions,
  checkRedisHealth,
};

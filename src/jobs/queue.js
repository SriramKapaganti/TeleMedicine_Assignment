'use strict';

const { Queue } = require('bullmq');
const { redisOptions, redisClient } = require('../config/redis');
const logger = require('../config/logger');

let bookingQueue = null;
let notificationQueue = null;
let analyticsQueue = null;

const defaultJobOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    age: 3600, // keep for 1 hour
    count: 1000,
  },
  removeOnFail: {
    age: 86400, // keep failures for 24h for debugging
  },
};

if (process.env.NODE_ENV !== 'test') {
  try {
    const connection = {
      host: redisOptions.host,
      port: redisOptions.port,
      password: redisOptions.password,
      db: redisOptions.db,
    };

    bookingQueue = new Queue('booking-queue', { connection, defaultJobOptions });
    notificationQueue = new Queue('notification-queue', { connection, defaultJobOptions });
    analyticsQueue = new Queue('analytics-queue', { connection, defaultJobOptions });

    logger.info('[QUEUE] BullMQ queues initialized');
  } catch (err) {
    logger.warn({ err }, '[QUEUE] BullMQ queue init error (Redis may be offline)');
  }
}

/**
 * Schedule slot expiry compensation job (local saga pattern).
 * Default delay is 10 minutes (600,000 ms).
 */
async function scheduleSlotExpiryJob(consultationId, slotId, delayMs = 10 * 60 * 1000) {
  if (!bookingQueue) {
    logger.warn({ consultationId }, '[QUEUE] BullMQ unavailable, skipping delayed expiry job');
    return;
  }
  try {
    await bookingQueue.add(
      'expire-slot',
      { consultationId, slotId },
      {
        delay: delayMs,
        jobId: `expiry-${consultationId}`,
      }
    );
    logger.info({ consultationId, slotId, delayMs }, '[QUEUE] Slot expiry saga job scheduled');
  } catch (err) {
    logger.error({ err, consultationId }, '[QUEUE] Failed to enqueue slot expiry job');
  }
}

/**
 * Enqueue notification job.
 */
async function enqueueNotification(payload) {
  if (!notificationQueue) return;
  try {
    await notificationQueue.add('send-notification', payload);
  } catch (err) {
    logger.error({ err }, '[QUEUE] Failed to enqueue notification job');
  }
}

module.exports = {
  bookingQueue,
  notificationQueue,
  analyticsQueue,
  scheduleSlotExpiryJob,
  enqueueNotification,
};

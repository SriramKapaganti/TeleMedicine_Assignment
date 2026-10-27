'use strict';

const { Worker } = require('bullmq');
const { redisOptions } = require('../config/redis');
const logger = require('../config/logger');
const { processSlotExpiry } = require('./slotExpiry.job');
const { processNotification } = require('./notification.job');
const { processAnalyticsRollup } = require('./analyticsRollup.job');

const connection = {
  host: redisOptions.host,
  port: redisOptions.port,
  password: redisOptions.password,
  db: redisOptions.db,
};

logger.info('[WORKER] Starting BullMQ background workers...');

// 1. Booking worker (handles slot hold expiry saga)
const bookingWorker = new Worker(
  'booking-queue',
  async (job) => {
    if (job.name === 'expire-slot') {
      return processSlotExpiry(job);
    }
  },
  { connection, concurrency: 5 }
);

bookingWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, name: job.name }, '[WORKER:BOOKING] Job completed');
});

bookingWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, name: job?.name, err: err.message }, '[WORKER:BOOKING] Job failed');
});

// 2. Notification worker
const notificationWorker = new Worker(
  'notification-queue',
  async (job) => {
    if (job.name === 'send-notification') {
      return processNotification(job);
    }
  },
  { connection, concurrency: 10 }
);

// 3. Analytics worker
const analyticsWorker = new Worker(
  'analytics-queue',
  async (job) => {
    if (job.name === 'rollup-daily') {
      return processAnalyticsRollup(job);
    }
  },
  { connection, concurrency: 1 }
);

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info({ signal }, '[WORKER] Shutting down workers gracefully...');
  await Promise.all([
    bookingWorker.close(),
    notificationWorker.close(),
    analyticsWorker.close(),
  ]);
  logger.info('[WORKER] All workers stopped cleanly');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { bookingWorker, notificationWorker, analyticsWorker };

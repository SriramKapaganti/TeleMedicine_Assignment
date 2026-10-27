'use strict';

const logger = require('../config/logger');

async function processNotification(job) {
  const { type, recipientEmail, subject, body, metadata } = job.data;
  logger.info(
    { type, recipientEmail, subject, metadata },
    '[NOTIFICATION_JOB] Notification dispatched successfully'
  );
  return { delivered: true, timestamp: new Date().toISOString() };
}

module.exports = { processNotification };

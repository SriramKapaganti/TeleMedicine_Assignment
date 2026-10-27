'use strict';

const { app } = require('./app');
const config = require('./config');
const logger = require('./config/logger');
const { pool } = require('./config/db');
const { redisClient } = require('./config/redis');

const server = app.listen(config.PORT, config.HOST, () => {
  logger.info(
    `[SERVER] Amrutam Telemedicine API running on http://${config.HOST}:${config.PORT}${config.API_PREFIX}`
  );
  logger.info(`[SERVER] API Docs available at http://${config.HOST}:${config.PORT}/docs`);
  logger.info(`[SERVER] Metrics available at http://${config.HOST}:${config.PORT}/metrics`);
});

// Graceful shutdown handling
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, '[SERVER] Graceful shutdown initiated...');

  server.close(async () => {
    logger.info('[SERVER] HTTP connections closed');

    try {
      if (redisClient && redisClient.status === 'ready') {
        await redisClient.quit();
        logger.info('[REDIS] Connection cleanly closed');
      }
    } catch (err) {
      logger.error({ err }, '[REDIS] Error closing connection');
    }

    try {
      await pool.end();
      logger.info('[DATABASE] PostgreSQL pool cleanly closed');
    } catch (err) {
      logger.error({ err }, '[DATABASE] Error closing PostgreSQL pool');
    }

    logger.info('[SERVER] Process exiting cleanly. Goodbye.');
    process.exit(0);
  });

  // Force shutdown if cleanup takes longer than 10 seconds
  setTimeout(() => {
    logger.error('[SERVER] Forced shutdown due to timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;

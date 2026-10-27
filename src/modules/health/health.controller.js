'use strict';

const { checkDbHealth } = require('../../config/db');
const { checkRedisHealth } = require('../../config/redis');
const { register } = require('../../middlewares/metrics');

class HealthController {
  live = (req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  };

  ready = async (req, res) => {
    try {
      const dbHealth = await checkDbHealth().catch((err) => ({ healthy: false, error: err.message }));
      const redisHealth = await checkRedisHealth().catch((err) => ({ ready: false, error: err.message }));

      const isReady = !!dbHealth.healthy;
      const status = isReady ? 'READY' : 'DEGRADED';

      res.status(isReady ? 200 : 503).json({
        status,
        timestamp: new Date().toISOString(),
        components: {
          database: dbHealth,
          redis: redisHealth,
        },
      });
    } catch (err) {
      res.status(503).json({
        status: 'DOWN',
        error: err.message,
      });
    }
  };

  metrics = async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
    } catch (err) {
      res.status(500).end(err.message);
    }
  };
}

module.exports = HealthController;

'use strict';

const client = require('prom-client');

// Initialize default system metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'amrutam_' });

// HTTP Request Duration Histogram
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [register],
});

// Bookings Total Counter
const bookingsTotal = new client.Counter({
  name: 'bookings_total',
  help: 'Total number of consultation bookings created',
  labelNames: ['status'],
  registers: [register],
});

// Booking Conflicts Counter (Double-booking attempts caught)
const bookingConflictsTotal = new client.Counter({
  name: 'booking_conflicts_total',
  help: 'Total number of booking conflicts detected (concurrency safety)',
  registers: [register],
});

// Idempotent Replays Counter
const idempotencyReplaysTotal = new client.Counter({
  name: 'idempotency_replays_total',
  help: 'Total number of requests served directly from idempotency cache',
  registers: [register],
});

function metricsMiddleware(req, res, next) {
  // Ignore Prometheus scrape endpoint itself
  if (req.path === '/metrics') {
    return next();
  }

  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const route = req.route ? req.baseUrl + req.route.path : req.path;

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode,
      },
      durationSeconds
    );
  });

  next();
}

module.exports = {
  register,
  metricsMiddleware,
  bookingsTotal,
  bookingConflictsTotal,
  idempotencyReplaysTotal,
};

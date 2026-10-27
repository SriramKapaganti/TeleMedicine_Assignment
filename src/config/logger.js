'use strict';

const pino = require('pino');
const config = require('./index');

const logger = pino({
  level: config.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'password_hash',
      'token',
      'refreshToken',
      'mfa_secret',
      'mfa_secret_enc',
      'medicines_enc',
      'notes_enc',
      'address_enc',
      'medical_history_enc',
    ],
    remove: true,
  },
});

module.exports = logger;

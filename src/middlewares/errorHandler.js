'use strict';

const logger = require('../config/logger');
const { AppError } = require('../utils/errors');

function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to Express default error handler
  if (res.headersSent) {
    return next(err);
  }

  const requestId = req.id || req.headers['x-request-id'] || 'unknown';

  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred on the server.';
  let details = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'SyntaxError' && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'MALFORMED_JSON';
    message = 'Request body contains invalid JSON syntax.';
  } else if (err.code === '23505') {
    // PostgreSQL unique constraint violation
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    message = 'A resource with this identifier or unique field already exists.';
    details = { detail: err.detail };
  } else if (err.code === '23503') {
    // PostgreSQL foreign key violation
    statusCode = 400;
    code = 'FOREIGN_KEY_VIOLATION';
    message = 'Referenced entity does not exist.';
    details = { detail: err.detail };
  } else if (err.code === '40001' || err.code === '40P01') {
    // PostgreSQL serialization failure or deadlock
    statusCode = 409;
    code = 'CONCURRENCY_CONFLICT';
    message = 'Concurrent modification detected. Please retry your request.';
  }

  // Log error: warn for operational errors, error for unexpected 500s
  if (statusCode >= 500) {
    logger.error(
      {
        err: {
          message: err.message,
          stack: err.stack,
          code: err.code,
        },
        requestId,
        url: req.originalUrl,
        method: req.method,
        userId: req.user ? req.user.id : null,
      },
      '[ERROR_HANDLER] Internal Server Error'
    );
  } else {
    logger.warn(
      {
        statusCode,
        code,
        message,
        details,
        requestId,
        url: req.originalUrl,
      },
      '[ERROR_HANDLER] Operational Error'
    );
  }

  res.status(statusCode).json({
    status: 'error',
    code,
    message,
    ...(details && { details }),
    requestId,
  });
}

module.exports = errorHandler;

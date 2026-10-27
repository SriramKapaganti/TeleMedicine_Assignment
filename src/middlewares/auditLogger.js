'use strict';

const { pool } = require('../config/db');
const logger = require('../config/logger');

/**
 * Persists an audit trail record asynchronously to the audit_logs table.
 */
async function recordAuditLog({
  actorId = null,
  actorRole = null,
  action,
  entity,
  entityId = null,
  ip = null,
  userAgent = null,
  metadata = {},
  requestId = null,
}) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  try {
    await pool.query(
      `INSERT INTO audit_logs 
        (actor_id, actor_role, action, entity, entity_id, ip, user_agent, metadata, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        actorId,
        actorRole,
        action,
        entity,
        entityId ? String(entityId) : null,
        ip,
        userAgent,
        JSON.stringify(metadata),
        requestId,
      ]
    );
  } catch (err) {
    logger.error({ err, action, entity }, '[AUDIT_LOG] Failed to write audit log');
  }
}

/**
 * Express middleware helper to automatically log write/mutate operations on endpoints.
 */
function auditMiddleware(action, entity, getEntityId = (req) => req.params.id) {
  return (req, res, next) => {
    res.on('finish', () => {
      // Only log on successful or operational status codes
      if (res.statusCode >= 200 && res.statusCode < 400) {
        recordAuditLog({
          actorId: req.user ? req.user.id : null,
          actorRole: req.user ? req.user.role : 'ANONYMOUS',
          action,
          entity,
          entityId: getEntityId(req),
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
          },
          requestId: req.id,
        });
      }
    });
    next();
  };
}

module.exports = {
  recordAuditLog,
  auditMiddleware,
};

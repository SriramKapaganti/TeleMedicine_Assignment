'use strict';

const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const { ROLES } = require('../../constants/roles');
const { auditLogQuerySchema } = require('./admin.validation');

function createAdminRoutes(adminController) {
  const router = express.Router();

  router.use(authenticate, authorize(ROLES.ADMIN));

  router.get('/analytics/overview', adminController.getOverview);
  router.get('/analytics/doctors', adminController.getDoctorAnalytics);
  router.get(
    '/audit-logs',
    validate({ query: auditLogQuerySchema }),
    adminController.getAuditLogs
  );

  return router;
}

module.exports = createAdminRoutes;

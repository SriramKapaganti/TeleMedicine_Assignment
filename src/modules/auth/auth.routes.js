'use strict';

const express = require('express');
const validate = require('../../middlewares/validate');
const authenticate = require('../../middlewares/authenticate');
const { authLimiter } = require('../../middlewares/rateLimiter');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  mfaVerifySchema,
} = require('./auth.validation');

function createAuthRoutes(authController) {
  const router = express.Router();

  router.post(
    '/register',
    authLimiter,
    validate({ body: registerSchema }),
    authController.register
  );

  router.post(
    '/login',
    authLimiter,
    validate({ body: loginSchema }),
    authController.login
  );

  router.post(
    '/refresh',
    validate({ body: refreshSchema }),
    authController.refresh
  );

  router.post(
    '/logout',
    authController.logout
  );

  router.post(
    '/mfa/setup',
    authenticate,
    authController.setupMfa
  );

  router.post(
    '/mfa/verify',
    authenticate,
    validate({ body: mfaVerifySchema }),
    authController.verifyMfa
  );

  return router;
}

module.exports = createAuthRoutes;

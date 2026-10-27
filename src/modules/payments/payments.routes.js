'use strict';

const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const validate = require('../../middlewares/validate');
const { paymentWebhookSchema } = require('./payments.validation');

function createPaymentsRoutes(paymentsController) {
  const router = express.Router();

  // Webhook endpoint (signature-verified & idempotent)
  router.post(
    '/webhook',
    validate({ body: paymentWebhookSchema }),
    paymentsController.webhook
  );

  // Authenticated payment view
  router.get(
    '/:id',
    authenticate,
    paymentsController.getById
  );

  return router;
}

module.exports = createPaymentsRoutes;

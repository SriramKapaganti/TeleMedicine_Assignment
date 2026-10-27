'use strict';

const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const validate = require('../../middlewares/validate');
const idempotency = require('../../middlewares/idempotency');
const { bookingLimiter } = require('../../middlewares/rateLimiter');
const {
  bookConsultationSchema,
  listConsultationsQuerySchema,
  cancelConsultationSchema,
} = require('./consultation.validation');

function createConsultationRoutes(consultationController) {
  const router = express.Router();

  router.use(authenticate);

  router.post(
    '/',
    bookingLimiter,
    idempotency({ required: true }),
    validate({ body: bookConsultationSchema }),
    consultationController.book
  );

  router.get(
    '/',
    validate({ query: listConsultationsQuerySchema }),
    consultationController.list
  );

  router.get('/:id', consultationController.getById);

  router.post(
    '/:id/cancel',
    validate({ body: cancelConsultationSchema }),
    consultationController.cancel
  );

  router.post('/:id/start', consultationController.start);

  router.post('/:id/complete', consultationController.complete);

  return router;
}

module.exports = createConsultationRoutes;

'use strict';

const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const { ROLES } = require('../../constants/roles');
const { createPrescriptionSchema } = require('./prescriptions.validation');

function createPrescriptionsRoutes(prescriptionsController) {
  const router = express.Router();

  router.use(authenticate);

  router.post(
    '/consultations/:id/prescriptions',
    authorize(ROLES.DOCTOR, ROLES.ADMIN),
    validate({ body: createPrescriptionSchema }),
    prescriptionsController.issue
  );

  router.get(
    '/consultations/:id/prescriptions',
    prescriptionsController.getByConsultation
  );

  router.get(
    '/prescriptions/:id',
    prescriptionsController.getById
  );

  return router;
}

module.exports = createPrescriptionsRoutes;

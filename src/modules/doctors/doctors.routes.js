'use strict';

const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const { ROLES } = require('../../constants/roles');
const {
  createDoctorSchema,
  searchDoctorQuerySchema,
} = require('./doctors.validation');

function createDoctorsRoutes(doctorsController) {
  const router = express.Router();

  // Public search & view endpoints
  router.get('/', validate({ query: searchDoctorQuerySchema }), doctorsController.search);
  router.get('/:id', doctorsController.getById);

  // Authenticated onboarding
  router.post(
    '/',
    authenticate,
    authorize(ROLES.DOCTOR, ROLES.ADMIN),
    validate({ body: createDoctorSchema }),
    doctorsController.onboard
  );

  // Admin verification
  router.patch(
    '/:id/verify',
    authenticate,
    authorize(ROLES.ADMIN),
    doctorsController.verify
  );

  return router;
}

module.exports = createDoctorsRoutes;

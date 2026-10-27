'use strict';

const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const { ROLES } = require('../../constants/roles');
const {
  bulkCreateSlotsSchema,
  getSlotsQuerySchema,
} = require('./availability.validation');

function createAvailabilityRoutes(availabilityController) {
  const router = express.Router();

  // Public/Patient view available slots for a doctor
  router.get(
    '/doctors/:id/slots',
    validate({ query: getSlotsQuerySchema }),
    availabilityController.getSlots
  );

  // Authenticated endpoints for doctors/admins
  router.post(
    '/doctors/:id/slots',
    authenticate,
    authorize(ROLES.DOCTOR, ROLES.ADMIN),
    validate({ body: bulkCreateSlotsSchema }),
    availabilityController.createSlots
  );

  router.delete(
    '/slots/:id',
    authenticate,
    authorize(ROLES.DOCTOR, ROLES.ADMIN),
    availabilityController.deleteSlot
  );

  return router;
}

module.exports = createAvailabilityRoutes;

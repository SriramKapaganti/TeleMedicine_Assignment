'use strict';

const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const { ROLES } = require('../../constants/roles');
const {
  updateMeSchema,
  updateStatusSchema,
  listUsersSchema,
} = require('./users.validation');

function createUsersRoutes(usersController) {
  const router = express.Router();

  router.use(authenticate);

  router.get('/me', usersController.getMe);
  router.patch('/me', validate({ body: updateMeSchema }), usersController.updateMe);

  // Admin only endpoints
  router.get(
    '/',
    authorize(ROLES.ADMIN),
    validate({ query: listUsersSchema }),
    usersController.listUsers
  );

  router.patch(
    '/:id/status',
    authorize(ROLES.ADMIN),
    validate({ body: updateStatusSchema }),
    usersController.updateStatus
  );

  return router;
}

module.exports = createUsersRoutes;

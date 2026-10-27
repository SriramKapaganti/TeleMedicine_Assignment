'use strict';

const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const validate = require('../../middlewares/validate');
const { updateProfileSchema } = require('./profiles.validation');

function createProfilesRoutes(profilesController) {
  const router = express.Router();

  router.use(authenticate);

  router.get('/', profilesController.getProfile);
  router.put('/', validate({ body: updateProfileSchema }), profilesController.updateProfile);

  return router;
}

module.exports = createProfilesRoutes;

'use strict';

const express = require('express');

function createHealthRoutes(healthController) {
  const router = express.Router();

  router.get('/live', healthController.live);
  router.get('/ready', healthController.ready);

  return router;
}

module.exports = createHealthRoutes;

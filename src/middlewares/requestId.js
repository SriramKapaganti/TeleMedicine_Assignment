'use strict';

const { v4: uuidv4 } = require('uuid');

function requestIdMiddleware(req, res, next) {
  const reqId = req.headers['x-request-id'] || uuidv4();
  req.id = reqId;
  res.setHeader('x-request-id', reqId);
  next();
}

module.exports = requestIdMiddleware;

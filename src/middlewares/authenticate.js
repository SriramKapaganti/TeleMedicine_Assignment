'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { UnauthorizedError } = require('../utils/errors');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET);
    req.user = {
      id: payload.sub || payload.id,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Access token has expired'));
    }
    return next(new UnauthorizedError('Invalid access token'));
  }
}

module.exports = authenticate;

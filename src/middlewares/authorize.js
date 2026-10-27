'use strict';

const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

/**
 * RBAC authorization middleware.
 * @param  {...string} allowedRoles 
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access forbidden: required role [${allowedRoles.join(', ')}], got [${req.user.role}]`
        )
      );
    }

    next();
  };
}

module.exports = authorize;

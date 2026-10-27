'use strict';

const { BadRequestError } = require('../utils/errors');

/**
 * Middleware factory for validating request parameters against a Zod schema.
 * 
 * @param {object} schemas - Object containing optional body, query, and params schemas
 * @param {import('zod').ZodSchema} [schemas.body]
 * @param {import('zod').ZodSchema} [schemas.query]
 * @param {import('zod').ZodSchema} [schemas.params]
 */
function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err.errors) {
        const issues = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return next(new BadRequestError('Validation error', issues));
      }
      return next(err);
    }
  };
}

module.exports = validate;

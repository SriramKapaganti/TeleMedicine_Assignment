'use strict';

const { z } = require('zod');
const { USER_STATUS } = require('../../constants/statuses');

const updateMeSchema = z.object({
  phone: z.string().min(8).max(20).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.LOCKED, USER_STATUS.SUSPENDED]),
});

const listUsersSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  role: z.enum(['PATIENT', 'DOCTOR', 'ADMIN']).optional(),
});

module.exports = {
  updateMeSchema,
  updateStatusSchema,
  listUsersSchema,
};

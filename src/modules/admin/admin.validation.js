'use strict';

const { z } = require('zod');

const auditLogQuerySchema = z.object({
  actorId: z.string().uuid().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  page: z.coerce.number().min(1).default(1),
});

module.exports = {
  auditLogQuerySchema,
};

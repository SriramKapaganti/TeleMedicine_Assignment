'use strict';

const { z } = require('zod');

const bookConsultationSchema = z.object({
  doctorId: z.string().uuid(),
  slotId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

const listConsultationsQuerySchema = z.object({
  status: z.enum([
    'PENDING_PAYMENT',
    'CONFIRMED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'EXPIRED',
    'NO_SHOW',
  ]).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  page: z.coerce.number().min(1).default(1),
});

const cancelConsultationSchema = z.object({
  cancellationReason: z.string().max(300).optional(),
});

module.exports = {
  bookConsultationSchema,
  listConsultationsQuerySchema,
  cancelConsultationSchema,
};

'use strict';

const { z } = require('zod');

const createSlotSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
}).refine((data) => new Date(data.endTime) > new Date(data.startTime), {
  message: 'endTime must be strictly after startTime',
  path: ['endTime'],
});

const bulkCreateSlotsSchema = z.object({
  slots: z.array(createSlotSchema).min(1).max(50),
});

const getSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['AVAILABLE', 'HELD', 'BOOKED', 'CANCELLED']).optional(),
});

module.exports = {
  createSlotSchema,
  bulkCreateSlotsSchema,
  getSlotsQuerySchema,
};

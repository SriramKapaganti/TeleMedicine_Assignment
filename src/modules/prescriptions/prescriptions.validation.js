'use strict';

const { z } = require('zod');

const medicineItemSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  duration: z.string().min(1),
  instructions: z.string().optional(),
});

const createPrescriptionSchema = z.object({
  medicines: z.array(medicineItemSchema).min(1),
  instructions: z.string().max(1000).optional(),
});

module.exports = {
  createPrescriptionSchema,
};

'use strict';

const { z } = require('zod');

const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD').optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  address: z.string().max(500).optional(),
  medicalHistory: z.union([z.string(), z.record(z.any())]).optional(),
});

module.exports = {
  updateProfileSchema,
};

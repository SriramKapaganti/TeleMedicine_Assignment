'use strict';

const { z } = require('zod');

const createDoctorSchema = z.object({
  specialization: z.string().min(2),
  licenseNo: z.string().min(3),
  experienceYrs: z.coerce.number().min(0).default(0),
  consultationFee: z.coerce.number().min(0),
  bio: z.string().max(1000).optional(),
});

const searchDoctorQuerySchema = z.object({
  specialization: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxFee: z.coerce.number().min(0).optional(),
  q: z.string().optional(), // full text search on doctor name
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: z.enum(['rating_desc', 'fee_asc', 'fee_desc', 'experience_desc']).default('rating_desc'),
  limit: z.coerce.number().min(1).max(50).default(10),
  page: z.coerce.number().min(1).default(1),
  cursor: z.string().optional(),
});

module.exports = {
  createDoctorSchema,
  searchDoctorQuerySchema,
};

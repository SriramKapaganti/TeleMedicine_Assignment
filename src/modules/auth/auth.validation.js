'use strict';

const { z } = require('zod');
const { ROLES } = require('../../constants/roles');

const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(8).max(20).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  role: z.enum([ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN]).default(ROLES.PATIENT),
  fullName: z.string().min(2, 'Full name is required'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
  mfaCode: z.string().length(6).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const mfaVerifySchema = z.object({
  token: z.string().length(6, 'TOTP code must be 6 digits'),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  mfaVerifySchema,
};

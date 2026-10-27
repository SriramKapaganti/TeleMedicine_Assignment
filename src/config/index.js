'use strict';

const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('localhost'),
  APP_NAME: z.string().default('amrutam-telemedicine-backend'),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('*'),

  // PostgreSQL
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default('amrutam_db'),
  DB_USER: z.string().default('amrutam_user'),
  DB_PASSWORD: z.string().default('amrutam_secure_password_2026'),
  DB_POOL_MIN: z.coerce.number().default(2),
  DB_POOL_MAX: z.coerce.number().default(20),
  DB_SSL: z.coerce.boolean().default(false),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_TLS: z.coerce.boolean().default(false),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(16).default('amrutam_super_secret_jwt_access_key_min_32_chars_2026!'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16).default('amrutam_super_secret_jwt_refresh_key_min_32_chars_2026!'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Encryption
  ENCRYPTION_KEY_CURRENT_VERSION: z.string().default('v1'),
  ENCRYPTION_KEY_V1: z.string().default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),

  // MFA
  MFA_SERVICE_NAME: z.string().default('AmrutamTelemedicine'),

  // Payment Webhook
  PAYMENT_WEBHOOK_SECRET: z.string().default('whsec_amrutam_payment_webhook_secret_key_2026'),

  // Logging & Metrics
  LOG_LEVEL: z.string().default('info'),
  PROMETHEUS_METRICS_PATH: z.string().default('/metrics'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('[CONFIG ERROR] Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

module.exports = parsedEnv.data;

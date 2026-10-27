'use strict';

const { z } = require('zod');

const paymentWebhookSchema = z.object({
  event: z.enum(['payment.success', 'payment.failed']),
  providerRef: z.string().min(1),
  consultationId: z.string().uuid(),
  amount: z.coerce.number().min(0),
  currency: z.string().default('INR'),
  timestamp: z.string().optional(),
});

module.exports = {
  paymentWebhookSchema,
};

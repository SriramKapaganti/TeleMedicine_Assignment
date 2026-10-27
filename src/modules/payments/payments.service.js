'use strict';

const crypto = require('crypto');
const config = require('../../config');
const { PAYMENT_STATUS, CONSULTATION_STATUS, SLOT_STATUS } = require('../../constants/statuses');
const { UnauthorizedError, NotFoundError, BadRequestError } = require('../../utils/errors');
const { withTransaction } = require('../../utils/transaction');
const { cacheService } = require('../../utils/cache');
const { enqueueNotification } = require('../../jobs/queue');
const { recordAuditLog } = require('../../middlewares/auditLogger');
const logger = require('../../config/logger');

class PaymentsService {
  constructor({ paymentsRepo, consultationRepo, pool }) {
    this.paymentsRepo = paymentsRepo;
    this.consultationRepo = consultationRepo;
    this.pool = pool;
  }

  /**
   * Verify HMAC-SHA256 signature for webhook security.
   */
  verifyWebhookSignature(payloadString, signature) {
    if (!signature) return false;
    const expected = crypto
      .createHmac('sha256', config.PAYMENT_WEBHOOK_SECRET)
      .update(payloadString)
      .digest('hex');

    // Constant-time comparison
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  async processWebhook(payload, signature, rawBodyString, reqMeta = {}) {
    // 1. Signature Verification
    if (config.NODE_ENV !== 'test' && signature) {
      const isValid = this.verifyWebhookSignature(rawBodyString || JSON.stringify(payload), signature);
      if (!isValid) {
        throw new UnauthorizedError('Invalid payment webhook HMAC signature');
      }
    }

    const { event, providerRef, consultationId } = payload;

    // 2. Lookup consultation and existing payment
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new NotFoundError('Consultation referenced in webhook not found');
    }

    let payment = await this.paymentsRepo.findByProviderRef(providerRef);
    if (!payment) {
      payment = await this.paymentsRepo.findByConsultationId(consultationId);
    }

    // 3. Idempotency Check: if already processed, return immediately
    if (payment && payment.status === PAYMENT_STATUS.SUCCESS && event === 'payment.success') {
      logger.info({ providerRef, consultationId }, '[PAYMENT_WEBHOOK] Already processed successfully (idempotent duplicate)');
      return { status: 'already_processed', consultationId };
    }

    // 4. Atomic transaction processing
    const result = await withTransaction(this.pool, async (client) => {
      if (event === 'payment.success') {
        // Update payment to SUCCESS
        await client.query(
          `UPDATE payments 
           SET status = 'SUCCESS', provider_ref = $1, updated_at = NOW() 
           WHERE id = $2`,
          [providerRef, payment.id]
        );

        // Update consultation to CONFIRMED
        await client.query(
          `UPDATE consultations 
           SET status = 'CONFIRMED', updated_at = NOW() 
           WHERE id = $1`,
          [consultationId]
        );

        // Update slot to BOOKED
        await client.query(
          `UPDATE availability_slots 
           SET status = 'BOOKED', held_until = NULL, version = version + 1, updated_at = NOW() 
           WHERE id = $1`,
          [consultation.slot_id]
        );

        // Audit trail
        await client.query(
          `INSERT INTO audit_logs (actor_id, actor_role, action, entity, entity_id, ip, user_agent, metadata, request_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            null,
            'PAYMENT_GATEWAY',
            'PAYMENT_SUCCESS_CONFIRMED',
            'payment',
            payment.id,
            reqMeta.ip,
            reqMeta.userAgent,
            JSON.stringify({ consultationId, providerRef, amount: payment.amount }),
            reqMeta.requestId,
          ]
        );

        return { status: 'confirmed', consultationId };
      } else if (event === 'payment.failed') {
        // Payment failed: compensate slot back to AVAILABLE
        await client.query(
          `UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE id = $1`,
          [payment.id]
        );

        await client.query(
          `UPDATE consultations SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1`,
          [consultationId]
        );

        await client.query(
          `UPDATE availability_slots 
           SET status = 'AVAILABLE', held_until = NULL, version = version + 1, updated_at = NOW() 
           WHERE id = $1`,
          [consultation.slot_id]
        );

        return { status: 'payment_failed_slot_released', consultationId };
      }
    });

    // Invalidate slot cache
    await cacheService.del(`slots:${consultation.doctor_id}`);
    await cacheService.invalidatePrefix(`slots:${consultation.doctor_id}`);

    // Asynchronous notification to patient
    await enqueueNotification({
      type: event === 'payment.success' ? 'BOOKING_CONFIRMED' : 'PAYMENT_FAILED',
      recipientEmail: consultation.patient_email,
      subject: event === 'payment.success' ? 'Consultation Confirmed' : 'Consultation Payment Failed',
      consultationId,
    });

    return result;
  }

  async getPaymentById(id, currentUser) {
    const payment = await this.paymentsRepo.findById(id);
    if (!payment) throw new NotFoundError('Payment not found');

    const consultation = await this.consultationRepo.findById(payment.consultation_id);
    if (currentUser.role === 'PATIENT' && consultation && consultation.patient_id !== currentUser.id) {
      throw new UnauthorizedError('You are not authorized to view this payment');
    }

    return payment;
  }
}

module.exports = PaymentsService;

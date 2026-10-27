'use strict';

const { pool } = require('../config/db');
const { cacheService } = require('../utils/cache');
const { withTransaction } = require('../utils/transaction');
const { recordAuditLog } = require('../middlewares/auditLogger');
const logger = require('../config/logger');

/**
 * Saga compensation: processes expired slot hold.
 * If consultation is still PENDING_PAYMENT, releases slot back to AVAILABLE.
 */
async function processSlotExpiry(job) {
  const { consultationId, slotId } = job.data;
  logger.info({ consultationId, slotId }, '[SAGA] Checking slot hold expiry...');

  await withTransaction(pool, async (client) => {
    // 1. Check current consultation status
    const consultRes = await client.query(
      'SELECT status, doctor_id FROM consultations WHERE id = $1 FOR UPDATE',
      [consultationId]
    );

    if (consultRes.rowCount === 0) {
      logger.warn({ consultationId }, '[SAGA] Consultation not found during expiry check');
      return;
    }

    const { status, doctor_id: doctorId } = consultRes.rows[0];

    // If already confirmed, paid, or cancelled, no compensation needed
    if (status !== 'PENDING_PAYMENT') {
      logger.info(
        { consultationId, currentStatus: status },
        '[SAGA] Consultation is no longer PENDING_PAYMENT. Compensation skipped.'
      );
      return;
    }

    // 2. Mark consultation as EXPIRED
    await client.query(
      `UPDATE consultations 
       SET status = 'EXPIRED', updated_at = NOW() 
       WHERE id = $1`,
      [consultationId]
    );

    // 3. Compensate: Revert availability_slot from HELD back to AVAILABLE
    await client.query(
      `UPDATE availability_slots 
       SET status = 'AVAILABLE', held_until = NULL, version = version + 1, updated_at = NOW() 
       WHERE id = $1 AND status = 'HELD'`,
      [slotId]
    );

    // 4. Invalidate Redis slot cache for this doctor
    await cacheService.del(`slots:${doctorId}`);
    await cacheService.invalidatePrefix(`slots:${doctorId}`);

    // 5. Audit trail for compliance
    await recordAuditLog({
      actorId: null,
      actorRole: 'SYSTEM_SAGA',
      action: 'SAGA_SLOT_HOLD_EXPIRED',
      entity: 'consultation',
      entityId: consultationId,
      metadata: { slotId, previousStatus: 'PENDING_PAYMENT', newStatus: 'EXPIRED' },
    });

    logger.info(
      { consultationId, slotId },
      '[SAGA] Successfully expired unpaid consultation and restored slot availability.'
    );
  });
}

module.exports = { processSlotExpiry };

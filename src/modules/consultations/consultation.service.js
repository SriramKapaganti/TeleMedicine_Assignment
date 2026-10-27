'use strict';

const { v4: uuidv4 } = require('uuid');
const { ROLES } = require('../../constants/roles');
const { CONSULTATION_STATUS, SLOT_STATUS, PAYMENT_STATUS } = require('../../constants/statuses');
const { ConflictError, NotFoundError, ForbiddenError, BadRequestError } = require('../../utils/errors');
const { withTransaction } = require('../../utils/transaction');
const { cacheService } = require('../../utils/cache');
const { scheduleSlotExpiryJob, enqueueNotification } = require('../../jobs/queue');
const { bookingsTotal, bookingConflictsTotal } = require('../../middlewares/metrics');
const { recordAuditLog } = require('../../middlewares/auditLogger');
const { validateStatusTransition } = require('./consultation.state');
const logger = require('../../config/logger');

class ConsultationService {
  constructor({ consultationRepo, doctorsRepo, pool }) {
    this.consultationRepo = consultationRepo;
    this.doctorsRepo = doctorsRepo;
    this.pool = pool;
  }

  /**
   * Core booking flow with atomic slot hold, optimistic locking, and saga compensation.
   */
  async bookConsultation({ doctorId, slotId, reason }, currentUser, reqMeta = {}) {
    if (currentUser.role !== ROLES.PATIENT && currentUser.role !== ROLES.ADMIN) {
      throw new ForbiddenError('Only patients can book consultations');
    }

    const patientId = currentUser.id;

    // Verify doctor exists and get consultation fee
    const doctor = await this.doctorsRepo.findById(doctorId);
    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    const bookingResult = await withTransaction(this.pool, async (client) => {
      // 1. Atomic conditional update on slot to prevent race conditions / double bookings
      const slotUpdate = await client.query(
        `UPDATE availability_slots 
         SET status = 'HELD', 
             held_until = NOW() + interval '10 minutes', 
             version = version + 1,
             updated_at = NOW()
         WHERE id = $1 AND doctor_id = $2 AND status = 'AVAILABLE'
         RETURNING *`,
        [slotId, doctorId]
      );

      // If rowCount === 0, the slot was already taken or does not exist
      if (slotUpdate.rowCount === 0) {
        bookingConflictsTotal.inc();
        throw new ConflictError(
          'This slot is no longer available. It may have just been booked by another patient.'
        );
      }

      const heldSlot = slotUpdate.rows[0];

      // 2. Create Consultation in PENDING_PAYMENT status
      const consultInsert = await client.query(
        `INSERT INTO consultations (patient_id, doctor_id, slot_id, status, reason)
         VALUES ($1, $2, $3, 'PENDING_PAYMENT', $4)
         RETURNING *`,
        [patientId, doctorId, slotId, reason || null]
      );
      const consultation = consultInsert.rows[0];

      // 3. Initiate payment record
      const providerRef = `pay_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
      const paymentInsert = await client.query(
        `INSERT INTO payments (consultation_id, amount, currency, status, provider_ref)
         VALUES ($1, $2, 'INR', 'INITIATED', $3)
         RETURNING *`,
        [consultation.id, doctor.consultation_fee, providerRef]
      );
      const payment = paymentInsert.rows[0];

      // 4. Audit trail entry
      await client.query(
        `INSERT INTO audit_logs 
          (actor_id, actor_role, action, entity, entity_id, ip, user_agent, metadata, request_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          patientId,
          currentUser.role,
          'BOOK_CONSULTATION_INITIATED',
          'consultation',
          consultation.id,
          reqMeta.ip,
          reqMeta.userAgent,
          JSON.stringify({ slotId, doctorId, amount: doctor.consultation_fee, providerRef }),
          reqMeta.requestId,
        ]
      );

      return { consultation, payment, heldSlot };
    });

    // 4. Invalidate Redis slot cache for doctor
    await cacheService.del(`slots:${doctorId}`);
    await cacheService.invalidatePrefix(`slots:${doctorId}`);

    // 5. Track metric
    bookingsTotal.inc({ status: 'PENDING_PAYMENT' });

    // 6. Schedule Saga compensation: 10 minutes delayed BullMQ job
    await scheduleSlotExpiryJob(
      bookingResult.consultation.id,
      slotId,
      10 * 60 * 1000 // 10 minutes
    );

    logger.info(
      { consultationId: bookingResult.consultation.id, slotId },
      '[BOOKING] Successfully held slot and created pending consultation'
    );

    return {
      consultation: {
        id: bookingResult.consultation.id,
        patientId,
        doctorId,
        slotId,
        status: bookingResult.consultation.status,
        reason: bookingResult.consultation.reason,
        slotStartTime: bookingResult.heldSlot.start_time,
        slotEndTime: bookingResult.heldSlot.end_time,
        createdAt: bookingResult.consultation.created_at,
      },
      payment: {
        id: bookingResult.payment.id,
        amount: bookingResult.payment.amount,
        currency: bookingResult.payment.currency,
        status: bookingResult.payment.status,
        providerRef: bookingResult.payment.provider_ref,
        expiresInSeconds: 600, // 10 minutes
      },
    };
  }

  async listConsultations(currentUser, query) {
    const limit = query.limit || 20;
    const page = query.page || 1;
    const offset = (page - 1) * limit;

    let items = [];
    if (currentUser.role === ROLES.PATIENT) {
      items = await this.consultationRepo.findByPatient(currentUser.id, {
        status: query.status,
        limit,
        offset,
      });
    } else if (currentUser.role === ROLES.DOCTOR) {
      const doctor = await this.doctorsRepo.findByUserId(currentUser.id);
      if (!doctor) return { data: [], meta: { page, limit, count: 0 } };

      items = await this.consultationRepo.findByDoctor(doctor.id, {
        status: query.status,
        limit,
        offset,
      });
    } else if (currentUser.role === ROLES.ADMIN) {
      const res = await this.pool.query(
        `SELECT c.*, s.start_time, s.end_time, d.specialization 
         FROM consultations c
         JOIN availability_slots s ON c.slot_id = s.id
         JOIN doctors d ON c.doctor_id = d.id
         ORDER BY c.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      items = res.rows;
    }

    return {
      data: items,
      meta: {
        page,
        limit,
        count: items.length,
      },
    };
  }

  async getConsultationById(id, currentUser) {
    const consultation = await this.consultationRepo.findById(id);
    if (!consultation) throw new NotFoundError('Consultation not found');

    // Ownership check (OWASP A01: Broken Access Control)
    if (currentUser.role === ROLES.PATIENT && consultation.patient_id !== currentUser.id) {
      throw new ForbiddenError('You can only view your own consultations');
    }

    if (currentUser.role === ROLES.DOCTOR) {
      const doctor = await this.doctorsRepo.findByUserId(currentUser.id);
      if (!doctor || consultation.doctor_id !== doctor.id) {
        throw new ForbiddenError('You can only view consultations assigned to you');
      }
    }

    return consultation;
  }

  async cancelConsultation(id, cancellationReason, currentUser, reqMeta = {}) {
    const consultation = await this.getConsultationById(id, currentUser);

    validateStatusTransition(consultation.status, CONSULTATION_STATUS.CANCELLED);

    await withTransaction(this.pool, async (client) => {
      // Update consultation status
      await client.query(
        `UPDATE consultations 
         SET status = 'CANCELLED', updated_at = NOW() 
         WHERE id = $1`,
        [id]
      );

      // Revert slot back to AVAILABLE if it was HELD or BOOKED
      await client.query(
        `UPDATE availability_slots 
         SET status = 'AVAILABLE', held_until = NULL, version = version + 1, updated_at = NOW() 
         WHERE id = $1`,
        [consultation.slot_id]
      );

      // Audit log
      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, entity, entity_id, ip, user_agent, metadata, request_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          currentUser.id,
          currentUser.role,
          'CANCEL_CONSULTATION',
          'consultation',
          id,
          reqMeta.ip,
          reqMeta.userAgent,
          JSON.stringify({ cancellationReason, previousStatus: consultation.status }),
          reqMeta.requestId,
        ]
      );
    });

    await cacheService.del(`slots:${consultation.doctor_id}`);
    await cacheService.invalidatePrefix(`slots:${consultation.doctor_id}`);

    return { success: true, message: 'Consultation cancelled successfully' };
  }

  async startConsultation(id, currentUser) {
    const consultation = await this.getConsultationById(id, currentUser);
    if (currentUser.role !== ROLES.DOCTOR && currentUser.role !== ROLES.ADMIN) {
      throw new ForbiddenError('Only the doctor can start the consultation');
    }

    validateStatusTransition(consultation.status, CONSULTATION_STATUS.IN_PROGRESS);

    const updated = await this.pool.query(
      `UPDATE consultations 
       SET status = 'IN_PROGRESS', started_at = NOW(), updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    return updated.rows[0];
  }

  async completeConsultation(id, currentUser) {
    const consultation = await this.getConsultationById(id, currentUser);
    if (currentUser.role !== ROLES.DOCTOR && currentUser.role !== ROLES.ADMIN) {
      throw new ForbiddenError('Only the doctor can complete the consultation');
    }

    validateStatusTransition(consultation.status, CONSULTATION_STATUS.COMPLETED);

    const updated = await this.pool.query(
      `UPDATE consultations 
       SET status = 'COMPLETED', ended_at = NOW(), updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    return updated.rows[0];
  }
}

module.exports = ConsultationService;

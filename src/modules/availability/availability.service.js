'use strict';

const { ROLES } = require('../../constants/roles');
const { ForbiddenError, NotFoundError, BadRequestError } = require('../../utils/errors');
const { cacheService } = require('../../utils/cache');
const { recordAuditLog } = require('../../middlewares/auditLogger');

class AvailabilityService {
  constructor({ availabilityRepo, doctorsRepo }) {
    this.availabilityRepo = availabilityRepo;
    this.doctorsRepo = doctorsRepo;
  }

  async verifyDoctorOwnership(doctorId, currentUser) {
    if (currentUser.role === ROLES.ADMIN) return true;

    const doctor = await this.doctorsRepo.findById(doctorId);
    if (!doctor) throw new NotFoundError('Doctor not found');

    if (doctor.user_id !== currentUser.id) {
      throw new ForbiddenError('You do not have permission to manage this doctor’s availability');
    }
    return true;
  }

  async createSlots(doctorId, slots, currentUser, reqMeta = {}) {
    await this.verifyDoctorOwnership(doctorId, currentUser);

    const created = await this.availabilityRepo.bulkCreate(doctorId, slots);

    // Invalidate slot cache
    await cacheService.del(`slots:${doctorId}`);
    await cacheService.invalidatePrefix(`slots:${doctorId}`);

    await recordAuditLog({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      action: 'BULK_CREATE_SLOTS',
      entity: 'availability_slots',
      entityId: doctorId,
      metadata: { count: created.length },
      ip: reqMeta.ip,
      userAgent: reqMeta.userAgent,
      requestId: reqMeta.requestId,
    });

    return created;
  }

  async getSlots(doctorId, query) {
    const cacheKey = `slots:${doctorId}:${query.date || 'all'}:${query.status || 'all'}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const slots = await this.availabilityRepo.findByDoctor(doctorId, query);
    await cacheService.set(cacheKey, slots, 30); // 30s TTL
    return slots;
  }

  async deleteSlot(slotId, currentUser, reqMeta = {}) {
    const slot = await this.availabilityRepo.findById(slotId);
    if (!slot) throw new NotFoundError('Slot not found');

    await this.verifyDoctorOwnership(slot.doctor_id, currentUser);

    if (slot.status !== 'AVAILABLE') {
      throw new BadRequestError('Cannot delete a slot that is already held or booked');
    }

    const deleted = await this.availabilityRepo.deleteAvailableSlot(slotId);
    if (!deleted) throw new BadRequestError('Slot could not be deleted');

    // Invalidate slot cache
    await cacheService.del(`slots:${slot.doctor_id}`);
    await cacheService.invalidatePrefix(`slots:${slot.doctor_id}`);

    await recordAuditLog({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      action: 'DELETE_SLOT',
      entity: 'availability_slot',
      entityId: slotId,
      ip: reqMeta.ip,
      userAgent: reqMeta.userAgent,
      requestId: reqMeta.requestId,
    });

    return { success: true, message: 'Slot deleted successfully' };
  }
}

module.exports = AvailabilityService;

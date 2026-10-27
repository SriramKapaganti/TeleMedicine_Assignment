'use strict';

const { ROLES } = require('../../constants/roles');
const { ConflictError, NotFoundError, ForbiddenError } = require('../../utils/errors');
const { cacheService } = require('../../utils/cache');
const { recordAuditLog } = require('../../middlewares/auditLogger');

class DoctorsService {
  constructor({ doctorsRepo, usersRepo, searchService }) {
    this.doctorsRepo = doctorsRepo;
    this.usersRepo = usersRepo;
    this.searchService = searchService;
  }

  async onboardDoctor(userId, data, reqMeta = {}) {
    const user = await this.usersRepo.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    if (user.role !== ROLES.DOCTOR && user.role !== ROLES.ADMIN) {
      throw new ForbiddenError('Only users with DOCTOR role can onboard as doctor profile');
    }

    const existingDoctor = await this.doctorsRepo.findByUserId(userId);
    if (existingDoctor) {
      throw new ConflictError('Doctor profile already exists for this user');
    }

    const doctor = await this.doctorsRepo.create({
      userId,
      specialization: data.specialization,
      licenseNo: data.licenseNo,
      experienceYrs: data.experienceYrs,
      consultationFee: data.consultationFee,
      bio: data.bio,
    });

    // Invalidate search caches
    await cacheService.invalidatePrefix('doctors:search:');

    await recordAuditLog({
      actorId: userId,
      actorRole: user.role,
      action: 'DOCTOR_ONBOARDED',
      entity: 'doctor',
      entityId: doctor.id,
      ip: reqMeta.ip,
      userAgent: reqMeta.userAgent,
      requestId: reqMeta.requestId,
    });

    return doctor;
  }

  async getDoctorById(id) {
    const cacheKey = `doctor:profile:${id}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const doctor = await this.doctorsRepo.findById(id);
    if (!doctor) throw new NotFoundError('Doctor not found');

    await cacheService.set(cacheKey, doctor, 300); // 5 minutes TTL
    return doctor;
  }

  async searchDoctors(query) {
    return this.searchService.searchDoctors(query);
  }

  async verifyDoctor(doctorId, isVerified, adminUser) {
    const doctor = await this.doctorsRepo.findById(doctorId);
    if (!doctor) throw new NotFoundError('Doctor not found');

    const updated = await this.doctorsRepo.setVerified(doctorId, isVerified);

    // Invalidate profile and search caches
    await cacheService.del(`doctor:profile:${doctorId}`);
    await cacheService.invalidatePrefix('doctors:search:');

    await recordAuditLog({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      action: 'ADMIN_VERIFY_DOCTOR',
      entity: 'doctor',
      entityId: doctorId,
      metadata: { isVerified },
    });

    return updated;
  }
}

module.exports = DoctorsService;

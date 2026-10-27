'use strict';

const { encrypt, decrypt } = require('../../utils/crypto');
const { NotFoundError } = require('../../utils/errors');
const { recordAuditLog } = require('../../middlewares/auditLogger');

class ProfilesService {
  constructor({ profilesRepo }) {
    this.profilesRepo = profilesRepo;
  }

  async getProfile(userId, reqMeta = {}) {
    const profile = await this.profilesRepo.findByUserId(userId);
    if (!profile) throw new NotFoundError('Profile not found');

    // Decrypt PHI
    let address = null;
    let medicalHistory = null;
    try {
      if (profile.address_enc) {
        address = decrypt(profile.address_enc);
      }
      if (profile.medical_history_enc) {
        medicalHistory = decrypt(profile.medical_history_enc, true);
      }
    } catch {
      // Return redacted or null if decryption fails
    }

    // Audit PHI read
    await recordAuditLog({
      actorId: userId,
      actorRole: 'PATIENT',
      action: 'READ_PHI_PROFILE',
      entity: 'profile',
      entityId: profile.id,
      ip: reqMeta.ip,
      userAgent: reqMeta.userAgent,
      requestId: reqMeta.requestId,
    });

    return {
      id: profile.id,
      userId: profile.user_id,
      fullName: profile.full_name,
      dob: profile.dob,
      gender: profile.gender,
      address,
      medicalHistory,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  }

  async updateProfile(userId, data, reqMeta = {}) {
    let addressEnc = undefined;
    let medicalHistoryEnc = undefined;

    if (data.address !== undefined) {
      addressEnc = data.address ? encrypt(data.address) : null;
    }
    if (data.medicalHistory !== undefined) {
      medicalHistoryEnc = data.medicalHistory ? encrypt(data.medicalHistory) : null;
    }

    const updated = await this.profilesRepo.update(userId, {
      fullName: data.fullName,
      dob: data.dob,
      gender: data.gender,
      addressEnc,
      medicalHistoryEnc,
    });

    if (!updated) throw new NotFoundError('Profile not found');

    await recordAuditLog({
      actorId: userId,
      actorRole: 'PATIENT',
      action: 'UPDATE_PHI_PROFILE',
      entity: 'profile',
      entityId: updated.id,
      ip: reqMeta.ip,
      userAgent: reqMeta.userAgent,
      requestId: reqMeta.requestId,
    });

    return this.getProfile(userId, reqMeta);
  }
}

module.exports = ProfilesService;

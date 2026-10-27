'use strict';

const { ROLES } = require('../../constants/roles');
const { encrypt, decrypt } = require('../../utils/crypto');
const { ForbiddenError, NotFoundError, BadRequestError } = require('../../utils/errors');
const { recordAuditLog } = require('../../middlewares/auditLogger');

class PrescriptionsService {
  constructor({ prescriptionsRepo, consultationRepo, doctorsRepo }) {
    this.prescriptionsRepo = prescriptionsRepo;
    this.consultationRepo = consultationRepo;
    this.doctorsRepo = doctorsRepo;
  }

  async issuePrescription(consultationId, { medicines, instructions }, currentUser, reqMeta = {}) {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) throw new NotFoundError('Consultation not found');

    // Only doctor assigned to this consultation (or admin) can issue prescription
    let doctorId = consultation.doctor_id;
    if (currentUser.role === ROLES.DOCTOR) {
      const doctor = await this.doctorsRepo.findByUserId(currentUser.id);
      if (!doctor || doctor.id !== consultation.doctor_id) {
        throw new ForbiddenError('You can only issue prescriptions for your own consultations');
      }
      doctorId = doctor.id;
    } else if (currentUser.role !== ROLES.ADMIN) {
      throw new ForbiddenError('Only doctors can issue prescriptions');
    }

    if (consultation.status === 'CANCELLED' || consultation.status === 'EXPIRED') {
      throw new BadRequestError('Cannot issue prescription for cancelled or expired consultation');
    }

    // Encrypt PHI: medicines array and instructions
    const medicinesEnc = encrypt(medicines);
    const instructionsEnc = instructions ? encrypt(instructions) : null;

    const prescription = await this.prescriptionsRepo.create({
      consultationId,
      doctorId,
      patientId: consultation.patient_id,
      medicinesEnc,
      instructionsEnc,
    });

    await recordAuditLog({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      action: 'ISSUE_PRESCRIPTION',
      entity: 'prescription',
      entityId: prescription.id,
      metadata: { consultationId, patientId: consultation.patient_id },
      ip: reqMeta.ip,
      userAgent: reqMeta.userAgent,
      requestId: reqMeta.requestId,
    });

    return {
      id: prescription.id,
      consultationId: prescription.consultation_id,
      doctorId: prescription.doctor_id,
      patientId: prescription.patient_id,
      medicines,
      instructions,
      issuedAt: prescription.issued_at,
    };
  }

  formatDecryptedPrescription(row) {
    let medicines = [];
    let instructions = null;
    try {
      medicines = decrypt(row.medicines_enc, true);
      if (row.instructions_enc) {
        instructions = decrypt(row.instructions_enc);
      }
    } catch {
      // Redacted fallback if decryption key rotated
    }

    return {
      id: row.id,
      consultationId: row.consultation_id,
      doctorId: row.doctor_id,
      doctorName: row.doctor_name,
      doctorSpecialization: row.specialization,
      patientId: row.patient_id,
      patientName: row.patient_name,
      medicines,
      instructions,
      issuedAt: row.issued_at,
    };
  }

  async getPrescriptionById(id, currentUser, reqMeta = {}) {
    const prescription = await this.prescriptionsRepo.findById(id);
    if (!prescription) throw new NotFoundError('Prescription not found');

    // Access control
    if (currentUser.role === ROLES.PATIENT && prescription.patient_id !== currentUser.id) {
      throw new ForbiddenError('You can only view your own prescriptions');
    }

    if (currentUser.role === ROLES.DOCTOR) {
      const doctor = await this.doctorsRepo.findByUserId(currentUser.id);
      if (!doctor || doctor.id !== prescription.doctor_id) {
        throw new ForbiddenError('You can only view prescriptions issued by you');
      }
    }

    // Audit PHI read
    await recordAuditLog({
      actorId: currentUser.id,
      actorRole: currentUser.role,
      action: 'READ_PHI_PRESCRIPTION',
      entity: 'prescription',
      entityId: id,
      ip: reqMeta.ip,
      userAgent: reqMeta.userAgent,
      requestId: reqMeta.requestId,
    });

    return this.formatDecryptedPrescription(prescription);
  }

  async getPrescriptionsByConsultation(consultationId, currentUser, reqMeta = {}) {
    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) throw new NotFoundError('Consultation not found');

    if (currentUser.role === ROLES.PATIENT && consultation.patient_id !== currentUser.id) {
      throw new ForbiddenError('You can only view prescriptions for your own consultation');
    }

    const rows = await this.prescriptionsRepo.findByConsultationId(consultationId);
    return rows.map((r) => this.formatDecryptedPrescription(r));
  }
}

module.exports = PrescriptionsService;

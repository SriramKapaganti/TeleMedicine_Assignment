'use strict';

class PrescriptionsRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ consultationId, doctorId, patientId, medicinesEnc, instructionsEnc }) {
    const res = await this.pool.query(
      `INSERT INTO prescriptions 
        (consultation_id, doctor_id, patient_id, medicines_enc, instructions_enc)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [consultationId, doctorId, patientId, medicinesEnc, instructionsEnc]
    );
    return res.rows[0];
  }

  async findById(id) {
    const res = await this.pool.query(
      `SELECT pr.*, 
              p_doc.full_name as doctor_name, d.specialization,
              p_pat.full_name as patient_name
       FROM prescriptions pr
       JOIN doctors d ON pr.doctor_id = d.id
       JOIN users u_doc ON d.user_id = u_doc.id
       JOIN profiles p_doc ON u_doc.id = p_doc.user_id
       JOIN users u_pat ON pr.patient_id = u_pat.id
       JOIN profiles p_pat ON u_pat.id = p_pat.user_id
       WHERE pr.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findByConsultationId(consultationId) {
    const res = await this.pool.query(
      `SELECT pr.*, 
              p_doc.full_name as doctor_name, d.specialization,
              p_pat.full_name as patient_name
       FROM prescriptions pr
       JOIN doctors d ON pr.doctor_id = d.id
       JOIN users u_doc ON d.user_id = u_doc.id
       JOIN profiles p_doc ON u_doc.id = p_doc.user_id
       JOIN users u_pat ON pr.patient_id = u_pat.id
       JOIN profiles p_pat ON u_pat.id = p_pat.user_id
       WHERE pr.consultation_id = $1
       ORDER BY pr.issued_at DESC`,
      [consultationId]
    );
    return res.rows;
  }
}

module.exports = PrescriptionsRepository;

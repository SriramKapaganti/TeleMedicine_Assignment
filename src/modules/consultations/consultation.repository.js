'use strict';

class ConsultationRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findById(id) {
    const res = await this.pool.query(
      `SELECT c.*, 
              s.start_time, s.end_time, s.status as slot_status,
              d.specialization, d.consultation_fee,
              p_pat.full_name as patient_name, u_pat.email as patient_email,
              p_doc.full_name as doctor_name, u_doc.email as doctor_email
       FROM consultations c
       JOIN availability_slots s ON c.slot_id = s.id
       JOIN doctors d ON c.doctor_id = d.id
       JOIN users u_pat ON c.patient_id = u_pat.id
       JOIN profiles p_pat ON u_pat.id = p_pat.user_id
       JOIN users u_doc ON d.user_id = u_doc.id
       JOIN profiles p_doc ON u_doc.id = p_doc.user_id
       WHERE c.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findByPatient(patientId, { status, limit = 20, offset = 0 }) {
    let query = `
      SELECT c.*, s.start_time, s.end_time, d.specialization, p_doc.full_name as doctor_name
      FROM consultations c
      JOIN availability_slots s ON c.slot_id = s.id
      JOIN doctors d ON c.doctor_id = d.id
      JOIN users u_doc ON d.user_id = u_doc.id
      JOIN profiles p_doc ON u_doc.id = p_doc.user_id
      WHERE c.patient_id = $1
    `;
    const params = [patientId];

    if (status) {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }

    params.push(limit, offset);
    query += ` ORDER BY c.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async findByDoctor(doctorId, { status, limit = 20, offset = 0 }) {
    let query = `
      SELECT c.*, s.start_time, s.end_time, p_pat.full_name as patient_name
      FROM consultations c
      JOIN availability_slots s ON c.slot_id = s.id
      JOIN users u_pat ON c.patient_id = u_pat.id
      JOIN profiles p_pat ON u_pat.id = p_pat.user_id
      WHERE c.doctor_id = $1
    `;
    const params = [doctorId];

    if (status) {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }

    params.push(limit, offset);
    query += ` ORDER BY c.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async updateStatus(id, newStatus, client = null) {
    const db = client || this.pool;
    const res = await db.query(
      `UPDATE consultations 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [newStatus, id]
    );
    return res.rows[0] || null;
  }
}

module.exports = ConsultationRepository;

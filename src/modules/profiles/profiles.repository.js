'use strict';

class ProfilesRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ userId, fullName, dob = null, gender = null, addressEnc = null, medicalHistoryEnc = null }, client = null) {
    const db = client || this.pool;
    const res = await db.query(
      `INSERT INTO profiles (user_id, full_name, dob, gender, address_enc, medical_history_enc)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, fullName, dob, gender, addressEnc, medicalHistoryEnc]
    );
    return res.rows[0];
  }

  async findByUserId(userId) {
    const res = await this.pool.query(
      `SELECT * FROM profiles WHERE user_id = $1`,
      [userId]
    );
    return res.rows[0] || null;
  }

  async update(userId, { fullName, dob, gender, addressEnc, medicalHistoryEnc }) {
    const res = await this.pool.query(
      `UPDATE profiles 
       SET full_name = COALESCE($1, full_name),
           dob = COALESCE($2, dob),
           gender = COALESCE($3, gender),
           address_enc = COALESCE($4, address_enc),
           medical_history_enc = COALESCE($5, medical_history_enc),
           updated_at = NOW()
       WHERE user_id = $6
       RETURNING *`,
      [fullName, dob, gender, addressEnc, medicalHistoryEnc, userId]
    );
    return res.rows[0] || null;
  }
}

module.exports = ProfilesRepository;

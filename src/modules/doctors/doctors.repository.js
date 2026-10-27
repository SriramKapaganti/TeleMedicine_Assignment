'use strict';

class DoctorsRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ userId, specialization, licenseNo, experienceYrs, consultationFee, bio }, client = null) {
    const db = client || this.pool;
    const res = await db.query(
      `INSERT INTO doctors (user_id, specialization, license_no, experience_yrs, consultation_fee, bio)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, specialization, licenseNo, experienceYrs, consultationFee, bio || null]
    );
    return res.rows[0];
  }

  async findById(id) {
    const res = await this.pool.query(
      `SELECT d.*, p.full_name, p.gender, u.email, u.phone
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       JOIN profiles p ON u.id = p.user_id
       WHERE d.id = $1 AND u.deleted_at IS NULL`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findByUserId(userId) {
    const res = await this.pool.query(
      `SELECT * FROM doctors WHERE user_id = $1`,
      [userId]
    );
    return res.rows[0] || null;
  }

  async setVerified(id, isVerified = true) {
    const res = await this.pool.query(
      `UPDATE doctors SET is_verified = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [isVerified, id]
    );
    return res.rows[0] || null;
  }

  async search({ specialization, minRating, maxFee, q, date, sort, limit = 10, offset = 0 }) {
    const conditions = ['u.deleted_at IS NULL'];
    const params = [];

    if (specialization) {
      params.push(specialization);
      conditions.push(`d.specialization ILIKE $${params.length}`);
    }

    if (minRating !== undefined && minRating !== null) {
      params.push(minRating);
      conditions.push(`d.rating_avg >= $${params.length}`);
    }

    if (maxFee !== undefined && maxFee !== null) {
      params.push(maxFee);
      conditions.push(`d.consultation_fee <= $${params.length}`);
    }

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`p.full_name ILIKE $${params.length}`);
    }

    if (date) {
      // Must have available slots on this date
      params.push(`${date}%`);
      conditions.push(`
        EXISTS (
          SELECT 1 FROM availability_slots s
          WHERE s.doctor_id = d.id 
            AND s.status = 'AVAILABLE'
            AND s.start_time::text LIKE $${params.length}
        )
      `);
    }

    let orderBy = 'd.rating_avg DESC';
    if (sort === 'fee_asc') orderBy = 'd.consultation_fee ASC';
    else if (sort === 'fee_desc') orderBy = 'd.consultation_fee DESC';
    else if (sort === 'experience_desc') orderBy = 'd.experience_yrs DESC';

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit, offset);
    const limitOffsetParams = `$${params.length - 1} OFFSET $${params.length}`;

    const query = `
      SELECT d.id, d.user_id, d.specialization, d.license_no, d.experience_yrs,
             d.consultation_fee, d.rating_avg, d.is_verified, d.bio,
             p.full_name, p.gender, u.email
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      JOIN profiles p ON u.id = p.user_id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limitOffsetParams}
    `;

    const res = await this.pool.query(query, params);
    return res.rows;
  }
}

module.exports = DoctorsRepository;

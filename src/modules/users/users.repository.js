'use strict';

class UsersRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ email, phone, passwordHash, role = 'PATIENT' }, client = null) {
    const db = client || this.pool;
    const res = await db.query(
      `INSERT INTO users (email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, phone, role, status, mfa_enabled, created_at`,
      [email.toLowerCase(), phone || null, passwordHash, role]
    );
    return res.rows[0];
  }

  async findByEmail(email) {
    const res = await this.pool.query(
      `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );
    return res.rows[0] || null;
  }

  async findById(id) {
    const res = await this.pool.query(
      `SELECT id, email, phone, role, status, mfa_enabled, failed_attempts, locked_until, created_at, updated_at
       FROM users 
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return res.rows[0] || null;
  }

  async incrementFailedAttempts(id) {
    const res = await this.pool.query(
      `UPDATE users 
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE 
             WHEN failed_attempts + 1 >= 5 THEN NOW() + interval '15 minutes'
             ELSE locked_until 
           END,
           status = CASE 
             WHEN failed_attempts + 1 >= 5 THEN 'LOCKED'::user_status
             ELSE status 
           END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING failed_attempts, locked_until, status`,
      [id]
    );
    return res.rows[0];
  }

  async resetFailedAttempts(id) {
    await this.pool.query(
      `UPDATE users 
       SET failed_attempts = 0, locked_until = NULL, status = 'ACTIVE'::user_status, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  async updateMfaSecret(id, encryptedSecret, enabled = false) {
    const res = await this.pool.query(
      `UPDATE users 
       SET mfa_secret_enc = $1, mfa_enabled = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, mfa_enabled`,
      [encryptedSecret, enabled, id]
    );
    return res.rows[0];
  }

  async findAll({ limit = 20, offset = 0, role = null }) {
    let query = `
      SELECT u.id, u.email, u.phone, u.role, u.status, u.mfa_enabled, u.created_at, p.full_name
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.deleted_at IS NULL
    `;
    const params = [];
    if (role) {
      params.push(role);
      query += ` AND u.role = $${params.length}`;
    }
    params.push(limit, offset);
    query += ` ORDER BY u.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async updateStatus(id, status) {
    const res = await this.pool.query(
      `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, status`,
      [status, id]
    );
    return res.rows[0];
  }
}

module.exports = UsersRepository;

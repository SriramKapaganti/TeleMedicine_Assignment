'use strict';

class PaymentsRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findById(id) {
    const res = await this.pool.query(
      `SELECT * FROM payments WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findByProviderRef(providerRef) {
    const res = await this.pool.query(
      `SELECT * FROM payments WHERE provider_ref = $1`,
      [providerRef]
    );
    return res.rows[0] || null;
  }

  async findByConsultationId(consultationId) {
    const res = await this.pool.query(
      `SELECT * FROM payments WHERE consultation_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [consultationId]
    );
    return res.rows[0] || null;
  }

  async updateStatus(id, status, client = null) {
    const db = client || this.pool;
    const res = await db.query(
      `UPDATE payments 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );
    return res.rows[0] || null;
  }
}

module.exports = PaymentsRepository;

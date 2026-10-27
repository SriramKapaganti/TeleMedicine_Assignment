'use strict';

class AdminRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async getOverviewStats() {
    const totalUsers = await this.pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE role = 'PATIENT') as patients_count,
        COUNT(*) FILTER (WHERE role = 'DOCTOR') as doctors_count
      FROM users WHERE deleted_at IS NULL
    `);

    const consultationStats = await this.pool.query(`
      SELECT 
        COUNT(*) as total_consultations,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED') as confirmed,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
        COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled,
        COUNT(*) FILTER (WHERE status = 'EXPIRED') as expired
      FROM consultations
    `);

    const revenueStats = await this.pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_revenue,
        COUNT(*) as total_transactions
      FROM payments
      WHERE status = 'SUCCESS'
    `);

    return {
      users: totalUsers.rows[0],
      consultations: consultationStats.rows[0],
      revenue: revenueStats.rows[0],
    };
  }

  async getDoctorAnalytics() {
    const res = await this.pool.query(`
      SELECT 
        d.id as doctor_id,
        p.full_name as doctor_name,
        d.specialization,
        d.rating_avg,
        d.is_verified,
        COUNT(c.id) as total_consultations,
        COUNT(c.id) FILTER (WHERE c.status = 'COMPLETED') as completed_consultations,
        COALESCE(SUM(pay.amount) FILTER (WHERE pay.status = 'SUCCESS'), 0) as total_earnings
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      JOIN profiles p ON u.id = p.user_id
      LEFT JOIN consultations c ON d.id = c.doctor_id
      LEFT JOIN payments pay ON c.id = pay.consultation_id
      WHERE u.deleted_at IS NULL
      GROUP BY d.id, p.full_name, d.specialization, d.rating_avg, d.is_verified
      ORDER BY total_consultations DESC
    `);
    return res.rows;
  }

  async getAuditLogs({ actorId, action, entity, limit = 50, offset = 0 }) {
    let query = `
      SELECT id, actor_id, actor_role, action, entity, entity_id, ip, user_agent, metadata, request_id, created_at
      FROM audit_logs
    `;
    const params = [];
    const conditions = [];

    if (actorId) {
      params.push(actorId);
      conditions.push(`actor_id = $${params.length}`);
    }
    if (action) {
      params.push(action);
      conditions.push(`action = $${params.length}`);
    }
    if (entity) {
      params.push(entity);
      conditions.push(`entity = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const res = await this.pool.query(query, params);
    return res.rows;
  }
}

module.exports = AdminRepository;

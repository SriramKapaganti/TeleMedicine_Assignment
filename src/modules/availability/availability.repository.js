'use strict';

class AvailabilityRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async bulkCreate(doctorId, slots) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const createdSlots = [];

      for (const slot of slots) {
        const res = await client.query(
          `INSERT INTO availability_slots (doctor_id, start_time, end_time, status)
           VALUES ($1, $2, $3, 'AVAILABLE')
           ON CONFLICT (doctor_id, start_time) DO NOTHING
           RETURNING *`,
          [doctorId, slot.startTime, slot.endTime]
        );
        if (res.rowCount > 0) {
          createdSlots.push(res.rows[0]);
        }
      }

      await client.query('COMMIT');
      return createdSlots;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findByDoctor(doctorId, { date, status }) {
    let query = `
      SELECT id, doctor_id, start_time, end_time, status, held_until, version, created_at
      FROM availability_slots
      WHERE doctor_id = $1
    `;
    const params = [doctorId];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (date) {
      params.push(`${date}%`);
      query += ` AND start_time::text LIKE $${params.length}`;
    }

    query += ` ORDER BY start_time ASC`;

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async findById(slotId) {
    const res = await this.pool.query(
      `SELECT * FROM availability_slots WHERE id = $1`,
      [slotId]
    );
    return res.rows[0] || null;
  }

  async deleteAvailableSlot(slotId) {
    const res = await this.pool.query(
      `DELETE FROM availability_slots 
       WHERE id = $1 AND status = 'AVAILABLE' 
       RETURNING *`,
      [slotId]
    );
    return res.rowCount > 0;
  }
}

module.exports = AvailabilityRepository;

'use strict';

class TokenRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async saveRefreshToken({ userId, tokenHash, expiresAt }) {
    const res = await this.pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, tokenHash, expiresAt]
    );
    return res.rows[0];
  }

  async findByTokenHash(tokenHash) {
    const res = await this.pool.query(
      `SELECT * FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    return res.rows[0] || null;
  }

  async rotateRefreshToken(oldTokenHash, newTokenHash, newExpiresAt) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT * FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
        [oldTokenHash]
      );

      if (existing.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const tokenRecord = existing.rows[0];

      // Reuse detection: If token was already revoked, revoke all tokens for this user!
      if (tokenRecord.revoked_at) {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1`,
          [tokenRecord.user_id]
        );
        await client.query('COMMIT');
        return { compromised: true, userId: tokenRecord.user_id };
      }

      // Revoke old token and link replacement
      await client.query(
        `UPDATE refresh_tokens 
         SET revoked_at = NOW(), replaced_by_token_hash = $1 
         WHERE token_hash = $2`,
        [newTokenHash, oldTokenHash]
      );

      // Insert new token
      const inserted = await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [tokenRecord.user_id, newTokenHash, newExpiresAt]
      );

      await client.query('COMMIT');
      return { compromised: false, record: inserted.rows[0], userId: tokenRecord.user_id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async revokeAllUserTokens(userId) {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1`,
      [userId]
    );
  }
}

module.exports = TokenRepository;

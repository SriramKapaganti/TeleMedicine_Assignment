'use strict';

const { NotFoundError } = require('../../utils/errors');
const { recordAuditLog } = require('../../middlewares/auditLogger');

class UsersService {
  constructor({ usersRepo, profilesRepo, pool }) {
    this.usersRepo = usersRepo;
    this.profilesRepo = profilesRepo;
    this.pool = pool;
  }

  async getMe(userId) {
    const user = await this.usersRepo.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const profile = await this.profilesRepo.findByUserId(userId);
    return {
      ...user,
      profile,
    };
  }

  async updateMe(userId, { phone }) {
    if (phone) {
      await this.pool.query(
        `UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2`,
        [phone, userId]
      );
    }
    return this.getMe(userId);
  }

  async listUsers(query) {
    return this.usersRepo.findAll(query);
  }

  async updateUserStatus(targetUserId, status, adminUser) {
    const user = await this.usersRepo.findById(targetUserId);
    if (!user) throw new NotFoundError('User not found');

    const updated = await this.usersRepo.updateStatus(targetUserId, status);

    await recordAuditLog({
      actorId: adminUser.id,
      actorRole: adminUser.role,
      action: 'ADMIN_UPDATE_USER_STATUS',
      entity: 'user',
      entityId: targetUserId,
      metadata: { previousStatus: user.status, newStatus: status },
    });

    return updated;
  }
}

module.exports = UsersService;

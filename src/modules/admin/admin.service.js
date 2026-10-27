'use strict';

class AdminService {
  constructor({ adminRepo }) {
    this.adminRepo = adminRepo;
  }

  async getOverviewAnalytics() {
    return this.adminRepo.getOverviewStats();
  }

  async getDoctorAnalytics() {
    return this.adminRepo.getDoctorAnalytics();
  }

  async getAuditLogs(query) {
    const limit = query.limit || 50;
    const page = query.page || 1;
    const offset = (page - 1) * limit;

    const logs = await this.adminRepo.getAuditLogs({
      ...query,
      limit,
      offset,
    });

    return {
      data: logs,
      meta: {
        page,
        limit,
        count: logs.length,
      },
    };
  }
}

module.exports = AdminService;

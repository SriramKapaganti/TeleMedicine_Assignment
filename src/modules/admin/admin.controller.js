'use strict';

class AdminController {
  constructor(adminService) {
    this.adminService = adminService;
  }

  getOverview = async (req, res, next) => {
    try {
      const stats = await this.adminService.getOverviewAnalytics();
      res.status(200).json({ status: 'success', data: stats });
    } catch (err) {
      next(err);
    }
  };

  getDoctorAnalytics = async (req, res, next) => {
    try {
      const analytics = await this.adminService.getDoctorAnalytics();
      res.status(200).json({ status: 'success', data: analytics });
    } catch (err) {
      next(err);
    }
  };

  getAuditLogs = async (req, res, next) => {
    try {
      const logs = await this.adminService.getAuditLogs(req.query);
      res.status(200).json({ status: 'success', ...logs });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AdminController;

'use strict';

class ProfilesController {
  constructor(profilesService) {
    this.profilesService = profilesService;
  }

  getProfile = async (req, res, next) => {
    try {
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      };
      const profile = await this.profilesService.getProfile(req.user.id, meta);
      res.status(200).json({ status: 'success', data: profile });
    } catch (err) {
      next(err);
    }
  };

  updateProfile = async (req, res, next) => {
    try {
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      };
      const profile = await this.profilesService.updateProfile(req.user.id, req.body, meta);
      res.status(200).json({ status: 'success', data: profile });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ProfilesController;

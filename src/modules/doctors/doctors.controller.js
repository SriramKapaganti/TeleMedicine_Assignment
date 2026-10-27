'use strict';

class DoctorsController {
  constructor(doctorsService) {
    this.doctorsService = doctorsService;
  }

  onboard = async (req, res, next) => {
    try {
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      };
      const doctor = await this.doctorsService.onboardDoctor(req.user.id, req.body, meta);
      res.status(201).json({ status: 'success', data: doctor });
    } catch (err) {
      next(err);
    }
  };

  search = async (req, res, next) => {
    try {
      const result = await this.doctorsService.searchDoctors(req.query);
      res.status(200).json({ status: 'success', ...result });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const doctor = await this.doctorsService.getDoctorById(req.params.id);
      res.status(200).json({ status: 'success', data: doctor });
    } catch (err) {
      next(err);
    }
  };

  verify = async (req, res, next) => {
    try {
      const isVerified = req.body.isVerified !== undefined ? req.body.isVerified : true;
      const updated = await this.doctorsService.verifyDoctor(req.params.id, isVerified, req.user);
      res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = DoctorsController;

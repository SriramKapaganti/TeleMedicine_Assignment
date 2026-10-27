'use strict';

class PrescriptionsController {
  constructor(prescriptionsService) {
    this.prescriptionsService = prescriptionsService;
  }

  issue = async (req, res, next) => {
    try {
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      };
      const prescription = await this.prescriptionsService.issuePrescription(
        req.params.id,
        req.body,
        req.user,
        meta
      );
      res.status(201).json({ status: 'success', data: prescription });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      };
      const prescription = await this.prescriptionsService.getPrescriptionById(
        req.params.id,
        req.user,
        meta
      );
      res.status(200).json({ status: 'success', data: prescription });
    } catch (err) {
      next(err);
    }
  };

  getByConsultation = async (req, res, next) => {
    try {
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      };
      const list = await this.prescriptionsService.getPrescriptionsByConsultation(
        req.params.id,
        req.user,
        meta
      );
      res.status(200).json({ status: 'success', data: list });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = PrescriptionsController;

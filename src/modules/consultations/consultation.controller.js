'use strict';

class ConsultationController {
  constructor(consultationService) {
    this.consultationService = consultationService;
  }

  book = async (req, res, next) => {
    try {
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      };
      const result = await this.consultationService.bookConsultation(
        req.body,
        req.user,
        meta
      );
      res.status(201).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  list = async (req, res, next) => {
    try {
      const result = await this.consultationService.listConsultations(
        req.user,
        req.query
      );
      res.status(200).json({ status: 'success', ...result });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const consultation = await this.consultationService.getConsultationById(
        req.params.id,
        req.user
      );
      res.status(200).json({ status: 'success', data: consultation });
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req, res, next) => {
    try {
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      };
      const result = await this.consultationService.cancelConsultation(
        req.params.id,
        req.body.cancellationReason,
        req.user,
        meta
      );
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  start = async (req, res, next) => {
    try {
      const result = await this.consultationService.startConsultation(
        req.params.id,
        req.user
      );
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  complete = async (req, res, next) => {
    try {
      const result = await this.consultationService.completeConsultation(
        req.params.id,
        req.user
      );
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ConsultationController;

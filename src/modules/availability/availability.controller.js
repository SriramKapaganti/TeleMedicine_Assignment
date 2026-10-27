'use strict';

class AvailabilityController {
  constructor(availabilityService) {
    this.availabilityService = availabilityService;
  }

  createSlots = async (req, res, next) => {
    try {
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      };
      const slots = await this.availabilityService.createSlots(
        req.params.id,
        req.body.slots,
        req.user,
        meta
      );
      res.status(201).json({ status: 'success', data: slots });
    } catch (err) {
      next(err);
    }
  };

  getSlots = async (req, res, next) => {
    try {
      const slots = await this.availabilityService.getSlots(req.params.id, req.query);
      res.status(200).json({ status: 'success', data: slots });
    } catch (err) {
      next(err);
    }
  };

  deleteSlot = async (req, res, next) => {
    try {
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      };
      const result = await this.availabilityService.deleteSlot(
        req.params.id,
        req.user,
        meta
      );
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AvailabilityController;

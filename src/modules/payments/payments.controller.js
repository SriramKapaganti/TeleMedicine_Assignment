'use strict';

class PaymentsController {
  constructor(paymentsService) {
    this.paymentsService = paymentsService;
  }

  webhook = async (req, res, next) => {
    try {
      const signature = req.headers['x-signature'] || req.headers['x-webhook-signature'];
      const rawBody = req.rawBody || JSON.stringify(req.body);
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      };

      const result = await this.paymentsService.processWebhook(
        req.body,
        signature,
        rawBody,
        meta
      );
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req, res, next) => {
    try {
      const payment = await this.paymentsService.getPaymentById(req.params.id, req.user);
      res.status(200).json({ status: 'success', data: payment });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = PaymentsController;

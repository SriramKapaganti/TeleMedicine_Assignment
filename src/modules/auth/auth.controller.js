'use strict';

class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  register = async (req, res, next) => {
    try {
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      };
      const result = await this.authService.register(req.body, meta);
      res.status(201).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  login = async (req, res, next) => {
    try {
      const meta = {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      };
      const result = await this.authService.login(req.body, meta);
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req, res, next) => {
    try {
      const result = await this.authService.refreshToken(req.body.refreshToken);
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  setupMfa = async (req, res, next) => {
    try {
      const result = await this.authService.setupMfa(req.user.id);
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  verifyMfa = async (req, res, next) => {
    try {
      const result = await this.authService.verifyMfa(req.user.id, req.body.token);
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req, res, next) => {
    try {
      const refreshToken = req.body.refreshToken;
      const userId = req.user ? req.user.id : null;
      await this.authService.logout(refreshToken, userId);
      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully',
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AuthController;

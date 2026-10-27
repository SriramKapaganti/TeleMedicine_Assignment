'use strict';

class UsersController {
  constructor(usersService) {
    this.usersService = usersService;
  }

  getMe = async (req, res, next) => {
    try {
      const user = await this.usersService.getMe(req.user.id);
      res.status(200).json({ status: 'success', data: user });
    } catch (err) {
      next(err);
    }
  };

  updateMe = async (req, res, next) => {
    try {
      const updated = await this.usersService.updateMe(req.user.id, req.body);
      res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      next(err);
    }
  };

  listUsers = async (req, res, next) => {
    try {
      const users = await this.usersService.listUsers(req.query);
      res.status(200).json({ status: 'success', data: users });
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req, res, next) => {
    try {
      const updated = await this.usersService.updateUserStatus(
        req.params.id,
        req.body.status,
        req.user
      );
      res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = UsersController;

'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { ROLES } = require('../../constants/roles');
const { hashPassword, comparePassword } = require('../../utils/password');
const {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  ForbiddenError,
} = require('../../utils/errors');
const { withTransaction } = require('../../utils/transaction');
const { recordAuditLog } = require('../../middlewares/auditLogger');
const logger = require('../../config/logger');

class AuthService {
  constructor({ usersRepo, profilesRepo, tokenRepo, mfaService, pool }) {
    this.usersRepo = usersRepo;
    this.profilesRepo = profilesRepo;
    this.tokenRepo = tokenRepo;
    this.mfaService = mfaService;
    this.pool = pool;
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateTokens(user) {
    const payload = {
      sub: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, config.JWT_ACCESS_SECRET, {
      expiresIn: config.JWT_ACCESS_EXPIRES_IN,
    });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      tokenHash,
      expiresAt,
    };
  }

  async register({ email, phone, password, role = ROLES.PATIENT, fullName }, reqMeta = {}) {
    const existing = await this.usersRepo.findByEmail(email);
    if (existing) {
      throw new ConflictError('A user with this email address already exists');
    }

    const passwordHash = await hashPassword(password);

    const user = await withTransaction(this.pool, async (client) => {
      const newUser = await this.usersRepo.create(
        { email, phone, passwordHash, role },
        client
      );

      await this.profilesRepo.create(
        { userId: newUser.id, fullName },
        client
      );

      return newUser;
    });

    await recordAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_REGISTERED',
      entity: 'user',
      entityId: user.id,
      ip: reqMeta.ip,
      userAgent: reqMeta.userAgent,
      requestId: reqMeta.requestId,
    });

    const tokens = this.generateTokens(user);
    await this.tokenRepo.saveRefreshToken({
      userId: user.id,
      tokenHash: tokens.tokenHash,
      expiresAt: tokens.expiresAt,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        fullName,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  async login({ email, password, mfaCode }, reqMeta = {}) {
    const user = await this.usersRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 1. Account Lockout Check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      throw new ForbiddenError(
        `Account is temporarily locked due to multiple failed login attempts. Try again in ${remainingMinutes} minutes.`
      );
    }

    // 2. Password Check
    const validPassword = await comparePassword(password, user.password_hash);
    if (!validPassword) {
      const updated = await this.usersRepo.incrementFailedAttempts(user.id);
      if (updated.failed_attempts >= 5) {
        await recordAuditLog({
          actorId: user.id,
          actorRole: user.role,
          action: 'ACCOUNT_LOCKED',
          entity: 'user',
          entityId: user.id,
          ip: reqMeta.ip,
          userAgent: reqMeta.userAgent,
          requestId: reqMeta.requestId,
        });
        throw new ForbiddenError('Account locked due to 5 consecutive failed login attempts.');
      }
      throw new UnauthorizedError('Invalid email or password');
    }

    // 3. MFA Enforcement (Mandatory for DOCTOR and ADMIN, or if user enabled MFA)
    const requiresMfa = user.mfa_enabled || user.role === ROLES.DOCTOR || user.role === ROLES.ADMIN;

    if (requiresMfa) {
      if (!user.mfa_enabled) {
        // Must configure MFA
        const tempToken = jwt.sign(
          { sub: user.id, purpose: 'MFA_SETUP_REQUIRED', role: user.role },
          config.JWT_ACCESS_SECRET,
          { expiresIn: '10m' }
        );
        return {
          requiresMfaSetup: true,
          tempToken,
          message: 'MFA setup is mandatory for your role. Please setup TOTP MFA.',
        };
      }

      if (!mfaCode) {
        const tempToken = jwt.sign(
          { sub: user.id, purpose: 'MFA_VERIFY_REQUIRED', role: user.role },
          config.JWT_ACCESS_SECRET,
          { expiresIn: '5m' }
        );
        return {
          requiresMfa: true,
          tempToken,
          message: 'MFA code is required.',
        };
      }

      // Verify code
      const isValidMfa = this.mfaService.verifyToken(mfaCode, user.mfa_secret_enc);
      if (!isValidMfa) {
        throw new UnauthorizedError('Invalid MFA TOTP code');
      }
    }

    // Successful login: reset failed attempts
    await this.usersRepo.resetFailedAttempts(user.id);

    const tokens = this.generateTokens(user);
    await this.tokenRepo.saveRefreshToken({
      userId: user.id,
      tokenHash: tokens.tokenHash,
      expiresAt: tokens.expiresAt,
    });

    await recordAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_LOGIN_SUCCESS',
      entity: 'user',
      entityId: user.id,
      ip: reqMeta.ip,
      userAgent: reqMeta.userAgent,
      requestId: reqMeta.requestId,
    });

    const profile = await this.profilesRepo.findByUserId(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        fullName: profile?.full_name,
        mfaEnabled: user.mfa_enabled,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  async refreshToken(rawRefreshToken) {
    const tokenHash = this.hashToken(rawRefreshToken);
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = this.hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    const rotationResult = await this.tokenRepo.rotateRefreshToken(
      tokenHash,
      newTokenHash,
      newExpiresAt
    );

    if (!rotationResult) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Automatic reuse detection triggered
    if (rotationResult.compromised) {
      logger.warn({ userId: rotationResult.userId }, '[AUTH] Refresh token reuse detected! Revoked all sessions.');
      await recordAuditLog({
        actorId: rotationResult.userId,
        actorRole: 'UNKNOWN',
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        entity: 'refresh_tokens',
        entityId: rotationResult.userId,
      });
      throw new UnauthorizedError('Compromised session detected. All sessions have been terminated. Please log in again.');
    }

    const user = await this.usersRepo.findById(rotationResult.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is inactive or not found');
    }

    const newAccessToken = jwt.sign(
      { sub: user.id, id: user.id, email: user.email, role: user.role },
      config.JWT_ACCESS_SECRET,
      { expiresIn: config.JWT_ACCESS_EXPIRES_IN }
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  async setupMfa(userId) {
    const user = await this.usersRepo.findById(userId);
    if (!user) throw new BadRequestError('User not found');

    const mfa = this.mfaService.generateSecret(user.email);
    // Save secret but don't enable until verified with a token
    await this.usersRepo.updateMfaSecret(userId, mfa.encryptedSecret, false);

    return {
      secret: mfa.secret,
      otpauthUrl: mfa.otpauthUrl,
    };
  }

  async verifyMfa(userId, token) {
    const user = await this.pool.query(
      `SELECT mfa_secret_enc, role, email FROM users WHERE id = $1`,
      [userId]
    );
    if (user.rowCount === 0) throw new BadRequestError('User not found');

    const { mfa_secret_enc: secretEnc, role, email } = user.rows[0];
    const isValid = this.mfaService.verifyToken(token, secretEnc);
    if (!isValid) {
      throw new BadRequestError('Invalid verification code');
    }

    // Enable MFA
    await this.usersRepo.updateMfaSecret(userId, secretEnc, true);

    const tokens = this.generateTokens({ id: userId, email, role });
    await this.tokenRepo.saveRefreshToken({
      userId,
      tokenHash: tokens.tokenHash,
      expiresAt: tokens.expiresAt,
    });

    return {
      success: true,
      message: 'MFA verified and activated successfully',
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  async logout(rawRefreshToken, userId) {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      await this.pool.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
        [tokenHash]
      );
    } else if (userId) {
      await this.tokenRepo.revokeAllUserTokens(userId);
    }
    return { success: true };
  }
}

module.exports = AuthService;

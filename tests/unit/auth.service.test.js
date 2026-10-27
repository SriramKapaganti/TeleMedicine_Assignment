'use strict';

const AuthService = require('../../src/modules/auth/auth.service');
const { UnauthorizedError, ForbiddenError } = require('../../src/utils/errors');
const { hashPassword } = require('../../src/utils/password');

describe('Auth Service Unit Tests', () => {
  let mockUsersRepo;
  let mockProfilesRepo;
  let mockTokenRepo;
  let mockMfaService;
  let mockPool;
  let authService;

  beforeEach(() => {
    mockUsersRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      incrementFailedAttempts: jest.fn(),
      resetFailedAttempts: jest.fn(),
      updateMfaSecret: jest.fn(),
    };
    mockProfilesRepo = {
      create: jest.fn(),
      findByUserId: jest.fn(),
    };
    mockTokenRepo = {
      saveRefreshToken: jest.fn().mockResolvedValue({ id: 'tok-1' }),
      rotateRefreshToken: jest.fn(),
      revokeAllUserTokens: jest.fn(),
    };
    mockMfaService = {
      generateSecret: jest.fn(),
      verifyToken: jest.fn(),
    };
    mockPool = {
      connect: jest.fn().mockResolvedValue({
        query: jest.fn(),
        release: jest.fn(),
      }),
      query: jest.fn(),
    };

    authService = new AuthService({
      usersRepo: mockUsersRepo,
      profilesRepo: mockProfilesRepo,
      tokenRepo: mockTokenRepo,
      mfaService: mockMfaService,
      pool: mockPool,
    });
  });

  it('should generate valid tokens and hash refresh tokens with sha256', () => {
    const user = { id: 'usr-1', email: 'test@amrutam.global', role: 'PATIENT' };
    const tokens = authService.generateTokens(user);

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.tokenHash).toHaveLength(64); // sha256 hex length
  });

  it('should lock account after 5 failed password attempts', async () => {
    const hashedPassword = await hashPassword('CorrectPassword123!');
    mockUsersRepo.findByEmail.mockResolvedValue({
      id: 'usr-1',
      email: 'locked@amrutam.global',
      password_hash: hashedPassword,
      failed_attempts: 4,
      role: 'PATIENT',
      locked_until: null,
      mfa_enabled: false,
    });
    mockUsersRepo.incrementFailedAttempts.mockResolvedValue({
      failed_attempts: 5,
      locked_until: new Date(Date.now() + 15 * 60000),
      status: 'LOCKED',
    });

    await expect(
      authService.login({ email: 'locked@amrutam.global', password: 'WrongPassword' })
    ).rejects.toThrow(ForbiddenError);
  });

  it('should reject login if account is currently locked', async () => {
    mockUsersRepo.findByEmail.mockResolvedValue({
      id: 'usr-1',
      email: 'locked@amrutam.global',
      locked_until: new Date(Date.now() + 10 * 60000),
      status: 'LOCKED',
    });

    await expect(
      authService.login({ email: 'locked@amrutam.global', password: 'any' })
    ).rejects.toThrow(/Account is temporarily locked/);
  });

  it('should detect reuse of revoked refresh token and reject', async () => {
    mockTokenRepo.rotateRefreshToken.mockResolvedValue({
      compromised: true,
      userId: 'usr-compromised',
    });

    await expect(
      authService.refreshToken('some_reused_stolen_token')
    ).rejects.toThrow(/Compromised session detected/);
  });
});

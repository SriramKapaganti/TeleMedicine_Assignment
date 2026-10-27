'use strict';

const request = require('supertest');
const { app } = require('../../src/app');

const UsersRepository = require('../../src/modules/users/users.repository');

describe('Auth Integration Tests', () => {
  beforeEach(() => {
    jest.spyOn(UsersRepository.prototype, 'findByEmail').mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return 400 when registration body is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email' });

    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  it('should reject login with wrong credentials with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nobody@amrutam.global',
        password: 'NonExistentPassword123!',
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should check health endpoints without authentication', async () => {
    const res = await request(app).get('/health/live');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('UP');
  });
});

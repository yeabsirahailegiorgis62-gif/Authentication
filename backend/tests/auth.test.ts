import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { resetRateLimiterStores, createRateLimiter } from '../src/middleware/rateLimiter.js';

const request = supertest(app);

function getCookies(res: supertest.Response): string[] {
  const cookieHeader = res.get('Set-Cookie');
  if (!cookieHeader) return [];
  const rawArray = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
  return rawArray.map((c: string) => c.split(';')[0]);
}

describe('Better Auth Integration & Security Test Suite', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    resetRateLimiterStores();
    await prisma.verification.deleteMany();
    await prisma.securityEvent.deleteMany();
    await prisma.loginAttempt.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Phase 3: Better Auth Password & Security Rules', () => {
    it('should reject passwords under 12 characters during registration', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({
          email: 'shortpass@example.com',
          password: 'Short1!',
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Phase 5 & 6: Registration & Login Flows', () => {
    it('should register a new user successfully and return sanitized user without password', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({
          email: 'alice@example.com',
          password: 'ComplexPassword99#',
          name: 'Alice User',
        })
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('alice@example.com');
      expect(res.body.user.password).toBeUndefined();

      // Check set-cookie header
      const cookies = getCookies(res);
      expect(cookies.length).toBeGreaterThan(0);
    });

    it('should reject duplicate registration attempts', async () => {
      await request
        .post('/api/auth/register')
        .send({ email: 'bob@example.com', password: 'ComplexPassword99#' })
        .expect(201);

      const res = await request
        .post('/api/auth/register')
        .send({ email: 'bob@example.com', password: 'ComplexPassword99#' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should authenticate valid login and set session cookie', async () => {
      await request
        .post('/api/auth/register')
        .send({ email: 'charlie@example.com', password: 'ComplexPassword99#' });

      const res = await request
        .post('/api/auth/login')
        .send({ email: 'charlie@example.com', password: 'ComplexPassword99#' })
        .expect(200);

      expect(res.body.user.email).toBe('charlie@example.com');
      expect(res.body.user.password).toBeUndefined();
      expect(getCookies(res).length).toBeGreaterThan(0);
    });

    it('should return error message for invalid credentials', async () => {
      await request
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'ComplexPassword99#' })
        .expect(401);

      await request
        .post('/api/auth/register')
        .send({ email: 'david@example.com', password: 'ComplexPassword99#' });

      await request
        .post('/api/auth/login')
        .send({ email: 'david@example.com', password: 'WrongPassword123!' })
        .expect(401);
    });
  });

  describe('Phase 7: Rate Limiting & Protection', () => {
    it('should enforce rate limiting when request limit is exceeded', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 2 });
      const reqMock: any = { ip: '127.0.0.99', socket: {}, headers: { 'x-test-rate-limit': 'true' } };
      let nextCalled = false;

      limiter(reqMock, {} as any, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);

      nextCalled = false;
      limiter(reqMock, {} as any, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);

      let blockedResponse: any = null;
      const resBlock: any = {
        status: (code: number) => ({
          json: (data: any) => {
            blockedResponse = { code, data };
          },
        }),
      };
      limiter(reqMock, resBlock, () => {});
      expect(blockedResponse).toBeDefined();
      expect(blockedResponse.code).toBe(429);
      expect(blockedResponse.data.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('Phase 8 & 10: Authentication Guard & Current User Endpoint', () => {
    it('should reject access to protected endpoint without valid session cookie', async () => {
      const res = await request.get('/api/auth/me').expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return user profile when valid session cookie is provided', async () => {
      const regRes = await request
        .post('/api/auth/register')
        .send({ email: 'eve@example.com', password: 'ComplexPassword99#', name: 'Eve Security' });

      const cookies = getCookies(regRes);

      const meRes = await request
        .get('/api/auth/me')
        .set('Cookie', cookies)
        .expect(200);

      expect(meRes.body.user.email).toBe('eve@example.com');
      expect(meRes.body.user.name).toBe('Eve Security');
    });
  });

  describe('Phase 9 & 11: Session Management & Revocation', () => {
    it('should handle logout by revoking server-side session', async () => {
      const regRes = await request
        .post('/api/auth/register')
        .send({ email: 'frank@example.com', password: 'ComplexPassword99#' });

      const cookies = getCookies(regRes);

      await request
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .expect(200);

      // Attempting to access protected endpoint after logout must fail
      await request
        .get('/api/auth/me')
        .set('Cookie', cookies)
        .expect(401);
    });

    it('should list user active sessions', async () => {
      const regRes = await request
        .post('/api/auth/register')
        .send({ email: 'grace@example.com', password: 'ComplexPassword99#' });

      const cookies = getCookies(regRes);

      const sessionsRes = await request
        .get('/api/auth/sessions')
        .set('Cookie', cookies)
        .expect(200);

      expect(sessionsRes.body.sessions).toBeInstanceOf(Array);
      expect(sessionsRes.body.sessions.length).toBeGreaterThanOrEqual(1);
    });

    it('should prevent User A from revoking User B session', async () => {
      // User A
      const userARes = await request
        .post('/api/auth/register')
        .send({ email: 'usera@example.com', password: 'ComplexPassword99#' });
      const cookieA = getCookies(userARes);

      // User B
      const userBRes = await request
        .post('/api/auth/register')
        .send({ email: 'userb@example.com', password: 'ComplexPassword99#' });
      const cookieB = getCookies(userBRes);

      const sessionsB = await request
        .get('/api/auth/sessions')
        .set('Cookie', cookieB)
        .expect(200);
      const sessionBId = sessionsB.body.sessions[0].id;

      // User A attempts to revoke User B session
      const revokeRes = await request
        .delete(`/api/auth/sessions/${sessionBId}`)
        .set('Cookie', cookieA)
        .expect(403);

      expect(revokeRes.body.error.code).toBe('FORBIDDEN');
    });

    it('should support revoking all sessions for a user', async () => {
      const email = 'multisession@example.com';
      const pass = 'ComplexPassword99#';

      const reg = await request.post('/api/auth/register').send({ email, password: pass });
      const cookie1 = getCookies(reg);

      const login = await request.post('/api/auth/login').send({ email, password: pass });
      const cookie2 = getCookies(login);

      // Revoke all sessions using cookie2
      await request
        .delete('/api/auth/sessions')
        .set('Cookie', cookie2)
        .expect(200);

      // Both cookie1 and cookie2 should now be rejected
      await request.get('/api/auth/me').set('Cookie', cookie1).expect(401);
      await request.get('/api/auth/me').set('Cookie', cookie2).expect(401);
    });
  });

  describe('Password Reset & Forgot Password Workflows', () => {
    it('should handle forgot-password with generic response', async () => {
      const res1 = await request
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(res1.body.message).toContain('If an account with that email exists');

      await request
        .post('/api/auth/register')
        .send({ email: 'existing@example.com', password: 'ComplexPassword99#' });

      const res2 = await request
        .post('/api/auth/forgot-password')
        .send({ email: 'existing@example.com' })
        .expect(200);

      expect(res2.body.message).toContain('If an account with that email exists');
    });
  });
});

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { PasswordService } from '../src/services/password.service.js';
import { VerificationTokenService } from '../src/services/verificationToken.service.js';
import { SESSION_COOKIE_NAME } from '../src/utils/cookie.js';
import { resetRateLimiterStores, createRateLimiter } from '../src/middleware/rateLimiter.js';

const request = supertest(app);

function getCookies(res: supertest.Response): string[] {
  const cookieHeader = res.get('Set-Cookie');
  if (!cookieHeader) return [];
  return Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
}

describe('Secure Identity System Security Test Suite', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    resetRateLimiterStores();
    await prisma.verificationToken.deleteMany();
    await prisma.securityEvent.deleteMany();
    await prisma.loginAttempt.deleteMany();
    await prisma.session.deleteMany();
    await prisma.oAuthAccount.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Phase 3: Password Security', () => {
    it('should hash passwords using Argon2id', async () => {
      const plain = 'SuperSecurePass123!';
      const hash = await PasswordService.hashPassword(plain);
      expect(hash).toContain('$argon2id$');
      const isValid = await PasswordService.verifyPassword(hash, plain);
      expect(isValid).toBe(true);
      const isInvalid = await PasswordService.verifyPassword(hash, 'WrongPassword123!');
      expect(isInvalid).toBe(false);
    });

    it('should reject passwords under 12 characters', () => {
      const validation = PasswordService.validatePassword('Short123!');
      expect(validation.valid).toBe(false);
      expect(validation.message).toContain('at least 12 characters');
    });

    it('should reject common breached passwords', () => {
      const validation = PasswordService.validatePassword('password12345');
      expect(validation.valid).toBe(false);
      expect(validation.message).toContain('too common');
    });
  });

  describe('Phase 5 & 6: Registration & Login Flows', () => {
    it('should register a new user successfully and return sanitized user without passwordHash', async () => {
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
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.failedLoginCount).toBeUndefined();

      // Check cookie security
      const cookies = getCookies(res);
      expect(cookies.length).toBeGreaterThan(0);
      const sessionCookie = cookies.find((c: string) => c.includes(SESSION_COOKIE_NAME));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Lax');
    });

    it('should reject duplicate registration attempts', async () => {
      await request
        .post('/api/auth/register')
        .send({ email: 'bob@example.com', password: 'ComplexPassword99#' })
        .expect(201);

      const res = await request
        .post('/api/auth/register')
        .send({ email: 'bob@example.com', password: 'ComplexPassword99#' })
        .expect(400);

      expect(res.body.error.code).toBe('ACCOUNT_EXISTS');
    });

    it('should authenticate valid login and set HttpOnly cookie', async () => {
      await request
        .post('/api/auth/register')
        .send({ email: 'charlie@example.com', password: 'ComplexPassword99#' });

      const res = await request
        .post('/api/auth/login')
        .send({ email: 'charlie@example.com', password: 'ComplexPassword99#' })
        .expect(200);

      expect(res.body.user.email).toBe('charlie@example.com');
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(getCookies(res).length).toBeGreaterThan(0);
    });

    it('should return generic error message for invalid email or password to prevent account enumeration', async () => {
      const res1 = await request
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'ComplexPassword99#' })
        .expect(401);

      expect(res1.body.error.message).toBe('Invalid email or password.');

      await request
        .post('/api/auth/register')
        .send({ email: 'david@example.com', password: 'ComplexPassword99#' });

      const res2 = await request
        .post('/api/auth/login')
        .send({ email: 'david@example.com', password: 'WrongPassword123!' })
        .expect(401);

      expect(res2.body.error.message).toBe('Invalid email or password.');
    });
  });

  describe('Phase 7: Brute-Force Protection & Account Lockout', () => {
    it('should temporarily lock account after 10 failed login attempts', { timeout: 20000 }, async () => {
      const email = 'lockout@example.com';
      await request
        .post('/api/auth/register')
        .send({ email, password: 'ComplexPassword99#' });

      // Simulate 10 wrong password attempts
      for (let i = 0; i < 10; i++) {
        await request
          .post('/api/auth/login')
          .send({ email, password: 'WrongPassword123!' })
          .expect(401);
      }

      // 11th attempt should trigger temporary lockout error 423
      const res = await request
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassword123!' })
        .expect(423);

      expect(res.body.error.code).toBe('ACCOUNT_TEMPORARILY_LOCKED');
    });

    it('should enforce rate limiting when request limit is exceeded', async () => {
      const limiter = createRateLimiter({ windowMs: 60000, max: 2 });
      const reqMock: any = { ip: '127.0.0.99', socket: {}, headers: { 'x-test-rate-limit': 'true' } };
      const resMock: any = { status: (code: number) => ({ json: (data: any) => ({ code, data }) }) };

      let nextCalled = false;
      limiter(reqMock, resMock, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);

      nextCalled = false;
      limiter(reqMock, resMock, () => { nextCalled = true; });
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

  describe('Phase 8 & 10: Authentication Middleware & Current User Endpoint', () => {
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
      expect(meRes.body.user.passwordHash).toBeUndefined();
    });
  });

  describe('Phase 9 & 11: Session Management & Revocation', () => {
    it('should handle logout by revoking server-side session and clearing cookie', async () => {
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

    it('should list user active sessions without exposing token hashes', async () => {
      const regRes = await request
        .post('/api/auth/register')
        .send({ email: 'grace@example.com', password: 'ComplexPassword99#' });

      const cookies = getCookies(regRes);

      const sessionsRes = await request
        .get('/api/auth/sessions')
        .set('Cookie', cookies)
        .expect(200);

      expect(sessionsRes.body.sessions).toBeInstanceOf(Array);
      expect(sessionsRes.body.sessions.length).toBe(1);
      expect(sessionsRes.body.sessions[0].tokenHash).toBeUndefined();
      expect(sessionsRes.body.sessions[0].isCurrent).toBe(true);
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

  describe('Email Verification & Password Reset Workflows', () => {
    it('should verify email address using raw token and enforce single-use', async () => {
      const user = await prisma.user.create({
        data: { email: 'verify@example.com', passwordHash: 'hash' },
      });

      const { rawToken } = await VerificationTokenService.createToken(
        user.id,
        'EMAIL_VERIFICATION',
        60000
      );

      const res1 = await request
        .post('/api/auth/verify-email/confirm')
        .send({ token: rawToken })
        .expect(200);

      expect(res1.body.user.emailVerified).toBe(true);

      // Second attempt with same token must fail (single-use enforcement)
      const res2 = await request
        .post('/api/auth/verify-email/confirm')
        .send({ token: rawToken })
        .expect(400);

      expect(res2.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should handle forgot-password with generic response to prevent account enumeration', async () => {
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

    it('should reset password, enforce Argon2id & password rules, and revoke all active sessions', async () => {
      const email = 'resetpass@example.com';
      const oldPass = 'OldComplexPassword1!';
      const newPass = 'NewSuperPassword2026!';

      const regRes = await request.post('/api/auth/register').send({ email, password: oldPass });
      const activeCookie = getCookies(regRes);

      // Verify active session works
      await request.get('/api/auth/me').set('Cookie', activeCookie).expect(200);

      const user = await prisma.user.findUnique({ where: { email } });
      const { rawToken } = await VerificationTokenService.createToken(
        user!.id,
        'PASSWORD_RESET',
        15 * 60 * 1000
      );

      // Reset password
      await request
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: newPass })
        .expect(200);

      // Active session MUST be revoked after password reset
      await request.get('/api/auth/me').set('Cookie', activeCookie).expect(401);

      // Login with old password must fail
      await request.post('/api/auth/login').send({ email, password: oldPass }).expect(401);

      // Login with new password must succeed
      await request.post('/api/auth/login').send({ email, password: newPass }).expect(200);
    });
  });

  describe('Phase 12: Google OAuth / OIDC Identity Validation', () => {
    it('should process Google OAuth callback and link local session', async () => {
      const res = await request
        .get('/api/auth/google/callback?code=mock-authorization-code-123')
        .expect(302);

      expect(res.headers.location).toContain('/dashboard');
      const cookies = getCookies(res);
      expect(cookies.length).toBeGreaterThan(0);

      const sessionCookie = cookies.find((c: string) => c.includes(SESSION_COOKIE_NAME));
      expect(sessionCookie).toBeDefined();

      // Access protected endpoint with Google session cookie
      const meRes = await request.get('/api/auth/me').set('Cookie', [sessionCookie!]).expect(200);
      expect(meRes.body.user.email).toContain('@example.com');
    });
  });
});

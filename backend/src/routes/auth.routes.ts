import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';
import { SessionService } from '../services/session.service.js';
import { SecurityEventService } from '../services/securityEvent.service.js';
import { GoogleOAuthService } from '../services/google.service.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { setSessionCookie, clearSessionCookie, SESSION_COOKIE_NAME } from '../utils/cookie.js';
import { config } from '../config/env.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters long.')
    .max(128, 'Password must not exceed 128 characters.'),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

/**
 * POST /api/auth/register
 * Phase 5: Registration
 */
authRouter.post(
  '/register',
  authLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = registerSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const { user, rawToken } = await AuthService.register({
        email: validated.email,
        password: validated.password,
        name: validated.name,
        ipAddress,
        userAgent,
      });

      setSessionCookie(res, rawToken);
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/login
 * Phase 6: Login with brute force defense & rate limiting
 */
authRouter.post(
  '/login',
  authLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = loginSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const { user, rawToken } = await AuthService.login({
        email: validated.email,
        password: validated.password,
        ipAddress,
        userAgent,
      });

      setSessionCookie(res, rawToken);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/logout
 * Phase 9: Server-side session revocation & cookie removal
 */
authRouter.post(
  '/logout',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.session && req.user) {
        await SessionService.revokeSession(req.session.id, req.user.id);
        await SecurityEventService.logEvent({
          userId: req.user.id,
          type: 'SESSION_REVOKED',
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { sessionId: req.session.id, action: 'LOGOUT' },
        });
      }

      clearSessionCookie(res);
      res.status(200).json({ message: 'Successfully logged out.' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/auth/me
 * Phase 10: Current user profile
 */
authRouter.get(
  '/me',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      user: {
        id: req.user!.id,
        email: req.user!.email,
        name: req.user!.name,
        avatarUrl: req.user!.avatarUrl,
        emailVerified: req.user!.emailVerified,
      },
    });
  }
);

/**
 * GET /api/auth/sessions
 * Phase 11: Session management - list active user sessions
 */
authRouter.get(
  '/sessions',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessions = await SessionService.listSessions(req.user!.id, req.session!.id);
      res.status(200).json({ sessions });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/auth/sessions/:id
 * Phase 11: Revoke individual session with strict ownership authorization
 */
authRouter.delete(
  '/sessions/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targetSessionId = req.params.id as string;
      const revoked = await SessionService.revokeSession(targetSessionId, req.user!.id);

      if (!revoked) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Session not found or you are not authorized to revoke this session.',
          },
        });
        return;
      }

      await SecurityEventService.logEvent({
        userId: req.user!.id,
        type: 'SESSION_REVOKED',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata: { revokedSessionId: targetSessionId },
      });

      // If user revoked their current session, clear cookie
      if (targetSessionId === req.session!.id) {
        clearSessionCookie(res);
      }

      res.status(200).json({ message: 'Session successfully revoked.' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/auth/sessions
 * Phase 11: Revoke all active sessions for current user
 */
authRouter.delete(
  '/sessions',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const count = await SessionService.revokeAllSessions(req.user!.id);

      await SecurityEventService.logEvent({
        userId: req.user!.id,
        type: 'ALL_SESSIONS_REVOKED',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata: { totalRevoked: count },
      });

      clearSessionCookie(res);
      res.status(200).json({ message: `Successfully revoked all ${count} sessions.` });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/auth/google
 * Phase 12: Google OAuth initialization
 */
authRouter.get('/google', (req: Request, res: Response) => {
  const { url, state } = GoogleOAuthService.generateAuthUrl();
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 mins
  });
  res.redirect(url);
});

/**
 * GET /api/auth/google/callback
 * Phase 12: Google OAuth callback handler
 */
authRouter.get(
  '/google/callback',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code, state } = req.query;
      const savedState = req.cookies?.['oauth_state'];

      if (!code || typeof code !== 'string') {
        res.status(400).redirect(`${config.clientUrl}/login?error=OAUTH_MISSING_CODE`);
        return;
      }

      // Verify CSRF state token
      if (savedState && state !== savedState) {
        res.status(400).redirect(`${config.clientUrl}/login?error=OAUTH_STATE_MISMATCH`);
        return;
      }
      res.clearCookie('oauth_state');

      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const googleProfile = await GoogleOAuthService.verifyCodeAndGetProfile(code);
      const { rawToken } = await AuthService.handleGoogleAuth({
        profile: googleProfile,
        ipAddress,
        userAgent,
      });

      setSessionCookie(res, rawToken);
      res.redirect(`${config.clientUrl}/dashboard`);
    } catch (err) {
      console.error('[Google OAuth Error]', err);
      res.redirect(`${config.clientUrl}/login?error=OAUTH_FAILED`);
    }
  }
);

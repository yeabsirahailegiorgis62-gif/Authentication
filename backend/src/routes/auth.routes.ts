import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { auth } from '../lib/auth.js';
import { fromNodeHeaders } from 'better-auth/node';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { config } from '../config/env.js';

export const authRouter = Router();

function forwardBetterAuthHeaders(webResponse: any, expressRes: Response) {
  if (typeof webResponse.headers?.getSetCookie === 'function') {
    const cookies = webResponse.headers.getSetCookie();
    if (cookies && cookies.length > 0) {
      expressRes.setHeader('set-cookie', cookies);
    }
  }
  webResponse.headers?.forEach((value: string, key: string) => {
    if (key.toLowerCase() !== 'set-cookie') {
      expressRes.setHeader(key, value);
    }
  });
}

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

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters long.')
    .max(128, 'Password must not exceed 128 characters.'),
});

/**
 * POST /api/auth/register
 * Alias delegating to Better Auth signUpEmail
 */
authRouter.post(
  '/register',
  authLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = registerSchema.parse(req.body);
      const headers = fromNodeHeaders(req.headers);

      const result = await auth.api.signUpEmail({
        body: {
          email: validated.email,
          password: validated.password,
          name: validated.name || '',
        },
        headers,
        asResponse: true,
      });

      forwardBetterAuthHeaders(result, res);

      const data: any = await result.json();
      if (!result.ok) {
        res.status(result.status).json(data);
        return;
      }

      // Explicitly dispatch verification email via Resend
      try {
        await auth.api.sendVerificationEmail({
          body: {
            email: validated.email,
            callbackURL: `${config.clientUrl}/verify-email`,
          },
          headers,
        });
      } catch (emailErr) {
        console.error('[Registration] Failed to send verification email:', emailErr);
      }

      res.status(201).json({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          emailVerified: data.user.emailVerified,
          createdAt: data.user.createdAt,
          updatedAt: data.user.updatedAt,
        },
      });

    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/login
 * Alias delegating to Better Auth signInEmail
 */
authRouter.post(
  '/login',
  authLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = loginSchema.parse(req.body);
      const headers = fromNodeHeaders(req.headers);

      const result = await auth.api.signInEmail({
        body: {
          email: validated.email,
          password: validated.password,
        },
        headers,
        asResponse: true,
      });

      forwardBetterAuthHeaders(result, res);

      const data: any = await result.json();
      if (!result.ok) {
        res.status(result.status).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
          },
        });
        return;
      }

      res.status(200).json({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          emailVerified: data.user.emailVerified,
          createdAt: data.user.createdAt,
          updatedAt: data.user.updatedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/logout
 * Alias delegating to Better Auth signOut
 */
authRouter.post(
  '/logout',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const headers = fromNodeHeaders(req.headers);
      const result = await auth.api.signOut({
        headers,
        asResponse: true,
      });

      forwardBetterAuthHeaders(result, res);

      res.status(200).json({ message: 'Successfully logged out.' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/auth/me
 * Current user profile from Better Auth session
 */
authRouter.get(
  '/me',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: (user as any).image || (user as any).avatarUrl || null,
        emailVerified: user.emailVerified,
      },
    });
  }
);

/**
 * GET /api/auth/sessions
 * List active user sessions
 */
authRouter.get(
  '/sessions',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const headers = fromNodeHeaders(req.headers);
      const sessions = await auth.api.listSessions({ headers });
      const currentToken = req.session?.token;

      const formattedSessions = (sessions || []).map((s: any) => ({
        id: s.id,
        deviceName: s.userAgent || 'Unknown Device',
        ipAddress: s.ipAddress || null,
        userAgent: s.userAgent || null,
        createdAt: s.createdAt,
        lastActiveAt: s.updatedAt || s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: currentToken ? s.token === currentToken : false,
      }));

      res.status(200).json({ sessions: formattedSessions });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/auth/sessions/:id
 * Revoke individual session with ownership check
 */
authRouter.delete(
  '/sessions/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targetSessionId = req.params.id as string;
      const headers = fromNodeHeaders(req.headers);

      // Verify session ownership
      const userSessions = await auth.api.listSessions({ headers });
      const targetSession = (userSessions || []).find((s: any) => s.id === targetSessionId);

      if (!targetSession) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Session not found or you are not authorized to revoke this session.',
          },
        });
        return;
      }

      await auth.api.revokeSession({
        body: { token: targetSession.token },
        headers,
      });

      res.status(200).json({ message: 'Session successfully revoked.' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/auth/sessions
 * Revoke all sessions for current user
 */
authRouter.delete(
  '/sessions',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const headers = fromNodeHeaders(req.headers);
      await auth.api.revokeSessions({ headers });
      res.status(200).json({ message: 'Successfully revoked all sessions.' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/verify-email/confirm
 */
authRouter.post(
  '/verify-email/confirm',
  authLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
      const headers = fromNodeHeaders(req.headers);

      const result = await auth.api.verifyEmail({
        query: {
          token,
        },
        headers,
        asResponse: true,
      });

      forwardBetterAuthHeaders(result, res);

      const data: any = await result.json().catch(() => ({}));
      if (!result.ok) {
        res.status(result.status || 400).json({
          error: {
            code: 'VERIFICATION_FAILED',
            message: data.message || 'Invalid or expired verification token.',
          },
        });
        return;
      }

      res.status(200).json({
        message: 'Email address verified successfully.',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/verify-email/request
 */
authRouter.post(
  '/verify-email/request',
  authLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const headers = fromNodeHeaders(req.headers);

      await auth.api.sendVerificationEmail({
        body: {
          email,
          callbackURL: `${config.clientUrl}/verify-email`,
        },
        headers,
      });

      res.status(200).json({
        message: 'Verification email sent successfully. Please check your inbox.',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/forgot-password
 */

authRouter.post(
  '/forgot-password',
  authLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const headers = fromNodeHeaders(req.headers);

      if ((auth.api as any).forgetPassword) {
        await (auth.api as any).forgetPassword({
          body: {
            email,
            redirectTo: `${config.clientUrl}/reset-password`,
          },
          headers,
        });
      }

      res.status(200).json({
        message: 'If an account with that email exists, we have sent a password reset link.',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/reset-password
 */
authRouter.post(
  '/reset-password',
  authLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      const headers = fromNodeHeaders(req.headers);

      if ((auth.api as any).resetPassword) {
        await (auth.api as any).resetPassword({
          body: {
            newPassword: password,
            token,
          },
          headers,
        });
      }

      res.status(200).json({
        message: 'Password has been reset successfully. Please sign in with your new password.',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/auth/google
 */
authRouter.get('/google', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const headers = fromNodeHeaders(req.headers);
    const result = await auth.api.signInSocial({
      body: {
        provider: 'google',
        callbackURL: `${config.clientUrl}/dashboard`,
      },
      headers,
      asResponse: true,
    });

    forwardBetterAuthHeaders(result, res);

    const data: any = await result.json();
    if (data.url) {
      res.redirect(data.url);
    } else {
      res.redirect(`${config.clientUrl}/login?error=OAUTH_FAILED`);
    }
  } catch (err) {
    next(err);
  }
});

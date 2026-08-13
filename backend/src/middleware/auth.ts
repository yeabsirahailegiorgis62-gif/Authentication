import { Request, Response, NextFunction } from 'express';
import { auth } from '../lib/auth.js';
import { fromNodeHeaders } from 'better-auth/node';

/**
 * Authentication middleware verifying Better Auth session from incoming request headers/cookies.
 * Rejects invalid, expired, or missing sessions with HTTP 401.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please sign in.',
        },
      });
      return;
    }

    req.user = session.user as any;
    req.session = session.session as any;

    next();
  } catch (err) {
    next(err);
  }
}

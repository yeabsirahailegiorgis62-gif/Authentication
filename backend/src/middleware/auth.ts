import { Request, Response, NextFunction } from 'express';
import { SessionService } from '../services/session.service.js';
import { SESSION_COOKIE_NAME } from '../utils/cookie.js';

/**
 * Authentication middleware verifying server-side session from HttpOnly cookie.
 * Rejects invalid, expired, or revoked sessions with HTTP 401.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];

    if (!rawToken) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please sign in.',
        },
      });
      return;
    }

    const validationResult = await SessionService.validateSession(rawToken);

    if (!validationResult) {
      res.status(401).json({
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Your session has expired or been revoked. Please sign in again.',
        },
      });
      return;
    }

    req.user = validationResult.user;
    req.session = validationResult.session;

    next();
  } catch (err) {
    next(err);
  }
}

import { Response } from 'express';
import { config } from '../config/env.js';

export const SESSION_COOKIE_NAME = 'session_token';

/**
 * Sets the HttpOnly, Secure, SameSite=Lax session cookie on response.
 */
export function setSessionCookie(res: Response, rawToken: string): void {
  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

/**
 * Clears the session cookie on logout or session revocation.
 */
export function clearSessionCookie(res: Response): void {
  res.cookie(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });
}

import crypto from 'crypto';

/**
 * Generates a cryptographically random session token (32 bytes base64url).
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Computes SHA-256 hash of a session token for secure database storage.
 */
export function hashToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

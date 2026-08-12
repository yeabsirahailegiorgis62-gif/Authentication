import { prisma } from '../db/prisma.js';

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_BLOCKED'
  | 'GOOGLE_LOGIN'
  | 'SESSION_CREATED'
  | 'SESSION_REVOKED'
  | 'ALL_SESSIONS_REVOKED'
  | 'PASSWORD_CHANGED'
  | 'SUSPICIOUS_LOGIN';

export interface LogSecurityEventParams {
  userId?: string | null;
  type: SecurityEventType;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export class SecurityEventService {
  /**
   * Logs a security audit event to the database.
   * Ensures sensitive credentials or raw tokens are never recorded.
   */
  static async logEvent(params: LogSecurityEventParams): Promise<void> {
    try {
      let sanitizedMetadata: string | undefined = undefined;
      if (params.metadata) {
        // Strip any sensitive keys if accidentally passed
        const safeMetadata = { ...params.metadata };
        delete safeMetadata.password;
        delete safeMetadata.token;
        delete safeMetadata.rawToken;
        delete safeMetadata.secret;
        delete safeMetadata.clientSecret;
        sanitizedMetadata = JSON.stringify(safeMetadata);
      }

      await prisma.securityEvent.create({
        data: {
          userId: params.userId || null,
          type: params.type,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
          metadata: sanitizedMetadata || null,
        },
      });
    } catch (err) {
      console.error('Failed to log security event:', err);
    }
  }
}

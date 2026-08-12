import { Session, User } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { generateSessionToken, hashToken } from '../utils/token.js';

export interface FormattedSession {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

export class SessionService {
  /** Session lifetime: 30 days by default */
  static SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

  /**
   * Creates a new server-side session.
   * Stores ONLY the token hash in the database.
   * Returns the raw token to set in the HttpOnly cookie.
   */
  static async createSession(params: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
  }): Promise<{ rawToken: string; session: Session }> {
    const rawToken = generateSessionToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + SessionService.SESSION_LIFETIME_MS);

    const session = await prisma.session.create({
      data: {
        userId: params.userId,
        tokenHash,
        expiresAt,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        deviceName: params.deviceName || null,
      },
    });

    return { rawToken, session };
  }

  /**
   * Validates a session by hashing the browser raw token and fetching from DB.
   * Checks expiration and revocation status.
   */
  static async validateSession(rawToken: string): Promise<{ session: Session; user: User } | null> {
    if (!rawToken) return null;
    const tokenHash = hashToken(rawToken);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) return null;

    // Check if session has been revoked
    if (session.revokedAt !== null) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    // Throttle lastActiveAt update (only update if > 60s ago)
    const now = new Date();
    if (now.getTime() - session.lastActiveAt.getTime() > 60 * 1000) {
      prisma.session.update({
        where: { id: session.id },
        data: { lastActiveAt: now },
      }).catch(() => {}); // non-blocking background update
    }

    return { session, user: session.user };
  }

  /**
   * Revokes a single session belonging to the user.
   * Prevents revoking another user's session by enforcing userId match.
   */
  static async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: userId,
      },
    });

    if (!session) return false;

    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return true;
  }

  /**
   * Revokes all active sessions for a user (or all except current session).
   */
  static async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const result = await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}),
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Returns active sessions for user, omitting sensitive token hash.
   */
  static async listSessions(userId: string, currentSessionId?: string): Promise<FormattedSession[]> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      deviceName: s.deviceName,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      expiresAt: s.expiresAt,
      isCurrent: s.id === currentSessionId,
    }));
  }

  /**
   * Deletes expired sessions from database.
   */
  static async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: { lte: new Date() },
      },
    });
    return result.count;
  }
}

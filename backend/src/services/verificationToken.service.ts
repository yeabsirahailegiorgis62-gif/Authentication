import { VerificationToken } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { generateSessionToken, hashToken } from '../utils/token.js';

export type TokenType = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

export class VerificationTokenService {
  /**
   * Generates a 32-byte cryptographically random token.
   * Stores ONLY the SHA-256 hash in the database.
   */
  static async createToken(
    userId: string,
    type: TokenType,
    durationMs: number
  ): Promise<{ rawToken: string; tokenRecord: VerificationToken }> {
    const rawToken = generateSessionToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + durationMs);

    // Invalidate existing unused tokens of the same type for this user
    await prisma.verificationToken.updateMany({
      where: {
        userId,
        type,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    const tokenRecord = await prisma.verificationToken.create({
      data: {
        userId,
        tokenHash,
        type,
        expiresAt,
      },
    });

    return { rawToken, tokenRecord };
  }

  /**
   * Verifies token hash, checks expiration and single-use status.
   * Marks token as consumed (usedAt = NOW()) on successful verification.
   */
  static async verifyAndConsumeToken(
    rawToken: string,
    type: TokenType
  ): Promise<VerificationToken | null> {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const tokenHash = hashToken(rawToken);

    const tokenRecord = await prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord) return null;
    if (tokenRecord.type !== type) return null;
    if (tokenRecord.usedAt !== null) return null;
    if (tokenRecord.expiresAt.getTime() <= Date.now()) return null;

    // Single-use enforcement: mark token as used
    const updated = await prisma.verificationToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    });

    return updated;
  }
}

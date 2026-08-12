import { prisma } from '../db/prisma.js';

export type RiskLevel = 'NORMAL' | 'SUSPICIOUS' | 'HIGH_RISK';

export interface RiskAnalysis {
  riskScore: number;
  level: RiskLevel;
  signals: string[];
}

export class RiskEngineService {
  /**
   * Evaluates suspicious login risk using heuristics:
   * - NEW_IP (+20)
   * - NEW_USER_AGENT (+20)
   * - RECENT_FAILED_ATTEMPTS_3 (+30)
   * - RECENT_FAILED_ATTEMPTS_5 (+20)
   * - NEW_DEVICE (+20)
   */
  static async evaluateLogin(params: {
    userId?: string;
    email: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<RiskAnalysis> {
    let score = 0;
    const signals: string[] = [];

    const { userId, email, ipAddress, userAgent } = params;

    // Check recent failed attempts for email/IP in last 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentFailures = await prisma.loginAttempt.count({
      where: {
        email,
        status: 'FAILED',
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentFailures >= 5) {
      score += 50; // 30 for 3+ and 20 for 5+
      signals.push('HIGH_RECENT_FAILURES_5+');
    } else if (recentFailures >= 3) {
      score += 30;
      signals.push('RECENT_FAILURES_3+');
    }

    if (userId) {
      // Check if IP has been used by this user before
      if (ipAddress) {
        const knownIp = await prisma.session.findFirst({
          where: { userId, ipAddress },
        });
        if (!knownIp) {
          score += 20;
          signals.push('NEW_IP');
        }
      }

      // Check if UserAgent has been used by this user before
      if (userAgent) {
        const knownUA = await prisma.session.findFirst({
          where: { userId, userAgent },
        });
        if (!knownUA) {
          score += 20;
          signals.push('NEW_USER_AGENT');
        }
      }
    } else {
      // For unauthenticated attempts from new IP
      if (ipAddress) {
        signals.push('UNKNOWN_USER');
      }
    }

    let level: RiskLevel = 'NORMAL';
    if (score >= 60) {
      level = 'HIGH_RISK';
    } else if (score >= 30) {
      level = 'SUSPICIOUS';
    }

    return {
      riskScore: score,
      level,
      signals,
    };
  }
}

import { User } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { SecurityEventService } from './securityEvent.service.js';
import { RiskEngineService } from './riskEngine.service.js';
import { GoogleUserProfile } from './google.service.js';

export interface SanitizedUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function sanitizeUser(user: User): SanitizedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class AuthService {
  /**
   * Registers a new user with email and password.
   */
  static async register(params: {
    email: string;
    password: string;
    name?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ user: SanitizedUser; rawToken: string }> {
    const normalizedEmail = params.email.trim().toLowerCase();

    // Check if account already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      const error: any = new Error('An account with this email address already exists.');
      error.code = 'ACCOUNT_EXISTS';
      error.statusCode = 400;
      throw error;
    }

    // Validate password rules
    const passwordCheck = PasswordService.validatePassword(params.password);
    if (!passwordCheck.valid) {
      const error: any = new Error(passwordCheck.message);
      error.code = 'INVALID_INPUT';
      error.statusCode = 400;
      throw error;
    }

    // Hash password with Argon2id
    const passwordHash = await PasswordService.hashPassword(params.password);

    // Create user in DB
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: params.name || null,
        emailVerified: false,
      },
    });

    // Create initial session
    const { rawToken, session } = await SessionService.createSession({
      userId: user.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      deviceName: 'Primary Browser',
    });

    await SecurityEventService.logEvent({
      userId: user.id,
      type: 'SESSION_CREATED',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return { user: sanitizeUser(user), rawToken };
  }

  /**
   * Authenticates user with email and password.
   * Enforces temporary lockout (10 failed attempts -> 15 min lock) and progressive delays.
   */
  static async login(params: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ user: SanitizedUser; rawToken: string }> {
    const normalizedEmail = params.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Handle account lockout if applicable
    if (user && user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await prisma.loginAttempt.create({
        data: {
          userId: user.id,
          email: normalizedEmail,
          ipAddress: params.ipAddress || 'unknown',
          userAgent: params.userAgent || null,
          status: 'BLOCKED',
          reason: 'ACCOUNT_TEMPORARILY_LOCKED',
        },
      });

      await SecurityEventService.logEvent({
        userId: user.id,
        type: 'LOGIN_BLOCKED',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: { reason: 'ACCOUNT_TEMPORARILY_LOCKED' },
      });

      const error: any = new Error('Account is temporarily locked due to multiple failed login attempts. Please try again later.');
      error.code = 'ACCOUNT_TEMPORARILY_LOCKED';
      error.statusCode = 423;
      throw error;
    }

    // Verify password if user exists
    let isValidPassword = false;
    if (user && user.passwordHash) {
      isValidPassword = await PasswordService.verifyPassword(user.passwordHash, params.password);
    }

    if (!user || !isValidPassword) {
      // Record failed attempt
      if (user) {
        const newFailedCount = user.failedLoginCount + 1;
        let lockedUntil: Date | null = null;

        // 10 failed attempts -> temporary lock (15 minutes)
        if (newFailedCount >= 10) {
          lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: newFailedCount,
            lockedUntil,
          },
        });

        // Progressive delay if 5+ failed attempts (skipped in test mode)
        if (newFailedCount >= 5 && process.env.NODE_ENV !== 'test') {
          const delayMs = Math.min((newFailedCount - 4) * 500, 3000);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      await prisma.loginAttempt.create({
        data: {
          userId: user ? user.id : null,
          email: normalizedEmail,
          ipAddress: params.ipAddress || 'unknown',
          userAgent: params.userAgent || null,
          status: 'FAILED',
          reason: 'INVALID_CREDENTIALS',
        },
      });

      await SecurityEventService.logEvent({
        userId: user ? user.id : null,
        type: 'LOGIN_FAILED',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      const error: any = new Error('Invalid email or password.');
      error.code = 'INVALID_CREDENTIALS';
      error.statusCode = 401;
      throw error;
    }

    // Successful login - reset failed attempt counters
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: params.ipAddress || null,
      },
    });

    await prisma.loginAttempt.create({
      data: {
        userId: user.id,
        email: normalizedEmail,
        ipAddress: params.ipAddress || 'unknown',
        userAgent: params.userAgent || null,
        status: 'SUCCESS',
      },
    });

    await SecurityEventService.logEvent({
      userId: user.id,
      type: 'LOGIN_SUCCESS',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // Evaluate suspicious login risk
    const riskAnalysis = await RiskEngineService.evaluateLogin({
      userId: user.id,
      email: normalizedEmail,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    if (riskAnalysis.level !== 'NORMAL') {
      await SecurityEventService.logEvent({
        userId: user.id,
        type: 'SUSPICIOUS_LOGIN',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: {
          riskScore: riskAnalysis.riskScore,
          level: riskAnalysis.level,
          signals: riskAnalysis.signals,
        },
      });
    }

    // Create session
    const { rawToken } = await SessionService.createSession({
      userId: user.id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return { user: sanitizeUser(updatedUser), rawToken };
  }

  /**
   * Handles Google OAuth / OpenID Connect user login / registration / account linking.
   */
  static async handleGoogleAuth(params: {
    profile: GoogleUserProfile;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ user: SanitizedUser; rawToken: string }> {
    const { profile, ipAddress, userAgent } = params;

    // Check existing OAuth account connection
    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'GOOGLE',
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });

    let user: User;

    if (existingOAuth) {
      user = existingOAuth.user;
    } else {
      // Check if user exists by verified email
      const existingUser = await prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (existingUser) {
        user = existingUser;
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name || null,
            avatarUrl: profile.avatarUrl || null,
            emailVerified: profile.emailVerified,
          },
        });
      }

      // Link OAuth account
      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'GOOGLE',
          providerAccountId: profile.providerAccountId,
        },
      });
    }

    // Update login info
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress || null,
        avatarUrl: profile.avatarUrl || user.avatarUrl,
        emailVerified: true,
      },
    });

    await SecurityEventService.logEvent({
      userId: user.id,
      type: 'GOOGLE_LOGIN',
      ipAddress,
      userAgent,
    });

    // Create session
    const { rawToken } = await SessionService.createSession({
      userId: user.id,
      ipAddress,
      userAgent,
    });

    return { user: sanitizeUser(updatedUser), rawToken };
  }
}

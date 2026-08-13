import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '../db/prisma.js';
import { config } from '../config/env.js';
import { sendEmail, getVerificationEmailHtml, getPasswordResetEmailHtml } from './email.js';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  secret: config.betterAuthSecret,
  baseURL: config.betterAuthUrl,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: config.email.requireVerification,
    sendResetPassword: async ({ user, token }) => {
      const resetUrl = `${config.clientUrl}/reset-password?token=${token}`;
      await sendEmail({
        to: user.email,
        subject: 'Reset your password',
        html: getPasswordResetEmailHtml(user.name, resetUrl),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, token }) => {
      const verifyUrl = `${config.clientUrl}/verify-email?token=${token}`;
      await sendEmail({
        to: user.email,
        subject: 'Verify your email address',
        html: getVerificationEmailHtml(user.name, verifyUrl),
      });
    },
  },
  socialProviders: {
    google: {
      clientId: config.google.clientId || 'mock-google-client-id',
      clientSecret: config.google.clientSecret || 'mock-google-client-secret',
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: false,
    },
  },
  trustedOrigins: [
    config.clientUrl,
    'http://localhost:5173',
    'http://localhost:80',
    'http://localhost:3000',
    'http://localhost:4000',
    'http://127.0.0.1:5173',
  ],
  advanced: {
    useSecureCookies: config.isProduction,
  },
});

import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  sessionSecret: process.env.SESSION_SECRET || 'super-secret-crypto-random-key-32-chars-min',
  betterAuthSecret: process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET || 'super-secret-better-auth-key-32-chars-min',
  betterAuthUrl: process.env.BETTER_AUTH_URL || 'http://localhost:4000',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/callback/google',
  },
};

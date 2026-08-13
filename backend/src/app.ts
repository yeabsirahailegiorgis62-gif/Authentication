import express from 'express';
import cookieParser from 'cookie-parser';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import { securityHeaders, corsMiddleware } from './middleware/security.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { authRouter } from './routes/auth.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { config } from './config/env.js';

export const app = express();

app.set('trust proxy', 1);

app.use(securityHeaders);
app.use(corsMiddleware);
app.use(cookieParser(config.sessionSecret));

// Mount Better Auth handler for standard /api/auth/* routes
app.all('/api/auth/*', (req, res, next) => {
  // Pass to authRouter for custom aliases, or handle via toNodeHandler
  if (
    req.path === '/api/auth/register' ||
    req.path === '/api/auth/login' ||
    req.path === '/api/auth/logout' ||
    req.path === '/api/auth/me' ||
    req.path.startsWith('/api/auth/sessions') ||
    req.path === '/api/auth/forgot-password' ||
    req.path === '/api/auth/reset-password' ||
    req.path === '/api/auth/google'
  ) {
    return next();
  }
  return toNodeHandler(auth)(req, res);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(globalLimiter);

// Auth Router for custom aliases
app.use('/api/auth', authRouter);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Centralized Error Handling
app.use(errorHandler);

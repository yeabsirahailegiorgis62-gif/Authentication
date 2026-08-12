import express from 'express';
import cookieParser from 'cookie-parser';
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(globalLimiter);

// Auth Routes
app.use('/api/auth', authRouter);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Centralized Error Handling
app.use(errorHandler);

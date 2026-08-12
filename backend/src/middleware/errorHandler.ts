import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/env.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error Handler]', err);

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedIssues = err.issues.map((i) => i.message).join(' ');
    res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: formattedIssues || 'Invalid input data provided.',
        details: err.issues,
      },
    });
    return;
  }

  const statusCode = err.statusCode || 500;
  const code = err.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');

  // Generic message for internal server errors in production
  const message =
    statusCode === 500 && config.isProduction
      ? 'An internal server error occurred. Please try again later.'
      : err.message || 'An unexpected error occurred.';

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(config.isProduction ? {} : { stack: err.stack }),
    },
  });
}

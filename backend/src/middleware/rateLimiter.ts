import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * In-memory rate limiter store for development/single-instance deployment.
 * NOTE: For horizontally scaled production environments, replace this store
 * with a Redis-backed distributed rate limiter (e.g. ioredis + rate-limiter-flexible).
 */
const ipStore = new Map<string, RateLimitRecord>();
const emailStore = new Map<string, RateLimitRecord>();

export function resetRateLimiterStores(): void {
  ipStore.clear();
  emailStore.clear();
}

/**
 * Creates a configurable rate limiter middleware.
 */
export function createRateLimiter(options: {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  keyGenerator?: (req: Request) => string;
  message?: string;
  code?: string;
}) {
  const {
    windowMs,
    max,
    keyGenerator = (req) => req.ip || req.socket.remoteAddress || 'unknown',
    message = 'Too many requests. Please try again later.',
    code = 'RATE_LIMITED',
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();

    let record = ipStore.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      ipStore.set(key, record);
    } else {
      record.count += 1;
    }

    if (record.count > max) {
      res.status(429).json({
        error: {
          code,
          message,
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
        },
      });
      return;
    }

    next();
  };
}

// Pre-configured rate limiters
export const globalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // max 300 requests per 15 mins per IP
  message: 'Global request limit exceeded. Please slow down.',
});

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 login/register attempts per 15 mins per IP
  message: 'Too many authentication attempts. Please try again in a few minutes.',
  code: 'RATE_LIMITED',
});

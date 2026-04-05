import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../cache';
import { config } from '../config';
import { logger } from '../config/logger';

function makeStore() {
  const client = getRedisClient();
  if (!client) return undefined; // falls back to in-memory

  return new RedisStore({
    sendCommand: (...args: string[]) => (client as any).call(...args),
    prefix: 'finapi:rl:',
  });
}

const handler = (_req: any, res: any) => {
  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  });
};

/** Global rate limiter: 100 req / 15 min */
export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore(),
  handler,
  skip: () => config.env === 'test',
});

/** Auth-specific limiter: 10 req / 15 min (brute-force protection) */
export const authRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore(),
  handler: (_req: any, res: any) => {
    logger.warn('Auth rate limit exceeded', { ip: _req.ip });
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again in 15 minutes.',
      },
    });
  },
  skip: () => config.env === 'test',
});
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),

  database: {
    url: required('DATABASE_URL'),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },

  jwt: {
    accessSecret: required('ACCESS_TOKEN_SECRET'),
    accessTtlSeconds: parseInt(optional('ACCESS_TOKEN_TTL', '900'), 10),
    refreshTtlDays: parseInt(optional('REFRESH_TOKEN_TTL_DAYS', '30'), 10),
  },

  bcrypt: {
    cost: parseInt(optional('BCRYPT_COST', '12'), 10),
  },

  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(optional('RATE_LIMIT_MAX', '100'), 10),
    authMax: parseInt(optional('RATE_LIMIT_AUTH_MAX', '5'), 10),
  },

  cors: {
    origin: optional('CORS_ORIGIN', 'http://localhost:5173'),
  },

  log: {
    level: optional('LOG_LEVEL', 'info'),
  },

  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },

  cache: {
    summaryTtl: 300,      // 5 min
    trendsTtl: 600,       // 10 min
    categoriesTtl: 1800,  // 30 min
    listCountTtl: 120,    // 2 min
  },
};

export const isProd = config.env === 'production';
export const isDev  = config.env === 'development';
export const isTest = config.env === 'test';
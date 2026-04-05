import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../config/logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  return redisClient;
}

export function createRedisClient(): Redis {
  const client = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err) => logger.warn('Redis error (cache disabled):', { err: err.message }));
  client.on('close', () => logger.info('Redis connection closed'));

  redisClient = client;
  return client;
}

export async function connectRedis(): Promise<void> {
  try {
    const client = createRedisClient();
    await client.connect();
  } catch (err) {
    logger.warn('Redis unavailable — running without cache');
    redisClient = null;
  }
}

const APP_PREFIX = 'finapi';

function buildKey(...parts: string[]): string {
  return `${APP_PREFIX}:${parts.join(':')}`;
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    if (!redisClient) return null;
    try {
      const raw = await redisClient.get(buildKey(key));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!redisClient) return;
    try {
      await redisClient.setex(buildKey(key), ttlSeconds, JSON.stringify(value));
    } catch {
      // silent fail — cache is best-effort
    }
  },

  async del(...keys: string[]): Promise<void> {
    if (!redisClient) return;
    try {
      const prefixed = keys.map((k) => buildKey(k));
      await redisClient.del(...prefixed);
    } catch {
      // silent fail
    }
  },

  async delPattern(pattern: string): Promise<void> {
    if (!redisClient) return;
    try {
      const keys = await redisClient.keys(buildKey(pattern));
      if (keys.length) await redisClient.del(...keys);
    } catch {
      // silent fail
    }
  },
};

// ─── CACHE KEY FACTORIES ──────────────────────────────────────────────────────

export const CacheKeys = {
  dashboardSummary: (from: string, to: string) => `dashboard:summary:${from}:${to}`,
  dashboardTrends:  (period: string, window: number) => `dashboard:trends:${period}:${window}`,
  dashboardCategories: (from: string, to: string) => `dashboard:categories:${from}:${to}`,
  categoriesList:   () => 'categories:list',
  recordsCount:     (hash: string) => `records:count:${hash}`,
};
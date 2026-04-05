import { createApp } from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, getRedisClient } from './cache';
import { logger } from './config/logger';

async function bootstrap() {
  // ── Connect infrastructure
  await connectDatabase();
  await connectRedis();   // non-fatal — runs without Redis

  const app    = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`🚀 Finance API running`, {
      port:    config.port,
      env:     config.env,
      docs:    `http://localhost:${config.port}/api/docs`,
      health:  `http://localhost:${config.port}/health`,
    });
  });

  // ── Graceful shutdown
  async function shutdown(signal: string) {
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(async () => {
      await disconnectDatabase();
      const redis = getRedisClient();
      if (redis) await redis.quit();
      logger.info('All connections closed. Goodbye.');
      process.exit(0);
    });

    // Force exit after 10 s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    shutdown('unhandledRejection');
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
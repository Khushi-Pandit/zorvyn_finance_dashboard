import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import { config } from './config';
import { swaggerSpec } from './config/swagger';
import { globalRateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './config/logger';

// ─── Route modules ────────────────────────────────────────────────────────────
import authRouter       from './modules/auth/auth.router';
import usersRouter      from './modules/users/users.router';
import recordsRouter    from './modules/records/records.router';
import dashboardRouter  from './modules/dashboard/dashboard.router';
import categoriesRouter from './modules/categories/categories.router';
import auditRouter      from './modules/audit/audit.router';

// ─── App factory ─────────────────────────────────────────────────────────────

export function createApp() {
  const app = express();

  // ── Security headers
  app.use(helmet({
    contentSecurityPolicy: config.env === 'production',
  }));

  // ── CORS
  app.use(cors({
    origin:      config.cors.origin,
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ── Request logging (skip in test)
  if (config.env !== 'test') {
    app.use(morgan('combined', {
      stream: { write: (msg) => logger.info(msg.trim()) },
    }));
  }

  // ── Body parsing
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser());

  // ── Global rate limiter
  app.use(globalRateLimiter);

  // ── Health check (no auth)
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status:    'ok',
      timestamp: new Date().toISOString(),
      version:   '1.0.0',
      env:       config.env,
    });
  });

  // ── Swagger docs
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Finance API Docs',
    swaggerOptions:  { persistAuthorization: true },
  }));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

  // ── API v1 routes
  const v1 = express.Router();

  v1.use('/auth',       authRouter);
  v1.use('/users',      usersRouter);
  v1.use('/records',    recordsRouter);
  v1.use('/dashboard',  dashboardRouter);
  v1.use('/categories', categoriesRouter);
  v1.use('/audit-logs', auditRouter);

  app.use('/api/v1', v1);

  // ── 404 handler
  app.use(notFoundHandler);

  // ── Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
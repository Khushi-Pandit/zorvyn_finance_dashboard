import { Router, Response } from 'express';
import { AuthRequest } from '../../shared/types';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { sendSuccess } from '../../shared/utils';
import { Role } from '@prisma/client';
import {
  dashboardService,
  dashboardQuerySchema,
  trendsQuerySchema,
  topCategoriesSchema,
} from './dashboard.service';
import { z } from 'zod';

const recentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Total income, expenses, net balance for a period (All roles)
 *     parameters:
 *       - { in: query, name: date_from, schema: { type: string, format: date } }
 *       - { in: query, name: date_to,   schema: { type: string, format: date } }
 *       - { in: query, name: currency,  schema: { type: string, default: USD } }
 *     responses:
 *       200:
 *         description: Summary with income/expense totals, net balance, and transaction counts
 */
router.get('/summary', validate(dashboardQuerySchema, 'query'), async (req: AuthRequest, res: Response) => {
  const data = await dashboardService.getSummary(req.query as any);
  sendSuccess(res, data);
});

/**
 * @swagger
 * /dashboard/trends:
 *   get:
 *     tags: [Dashboard]
 *     summary: Monthly or weekly income/expense trend data (Analyst, Admin)
 *     parameters:
 *       - { in: query, name: period, schema: { type: string, enum: [monthly, weekly], default: monthly } }
 *       - { in: query, name: months, schema: { type: integer, default: 6, maximum: 24 } }
 *     responses:
 *       200: { description: Array of period buckets with income, expense, net values }
 *       403: { description: Analyst or Admin role required }
 */
router.get('/trends', authorize(Role.ANALYST, Role.ADMIN), validate(trendsQuerySchema, 'query'), async (req: AuthRequest, res: Response) => {
  const data = await dashboardService.getTrends(req.query as any);
  sendSuccess(res, { trends: data, count: (data as any[]).length });
});

/**
 * @swagger
 * /dashboard/categories:
 *   get:
 *     tags: [Dashboard]
 *     summary: Category-wise breakdown with totals and percentages (Analyst, Admin)
 *     parameters:
 *       - { in: query, name: date_from, schema: { type: string, format: date } }
 *       - { in: query, name: date_to,   schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Category breakdown by income and expense type }
 */
router.get('/categories', authorize(Role.ANALYST, Role.ADMIN), validate(dashboardQuerySchema, 'query'), async (req: AuthRequest, res: Response) => {
  const data = await dashboardService.getCategoryBreakdown(req.query as any);
  sendSuccess(res, { breakdown: data, count: (data as any[]).length });
});

/**
 * @swagger
 * /dashboard/recent:
 *   get:
 *     tags: [Dashboard]
 *     summary: Most recent transactions (All roles)
 *     parameters:
 *       - { in: query, name: limit, schema: { type: integer, default: 10, maximum: 50 } }
 *     responses:
 *       200: { description: Recent transactions with category info }
 */
router.get('/recent', validate(recentQuerySchema, 'query'), async (req: AuthRequest, res: Response) => {
  const { limit } = req.query as any;
  const records = await dashboardService.getRecent(Number(limit) || 10);
  sendSuccess(res, { records, count: records.length });
});

/**
 * @swagger
 * /dashboard/top-categories:
 *   get:
 *     tags: [Dashboard]
 *     summary: Top N categories by spend or income (Analyst, Admin)
 *     parameters:
 *       - { in: query, name: limit,     schema: { type: integer, default: 5, maximum: 20 } }
 *       - { in: query, name: type,      schema: { type: string, enum: [INCOME, EXPENSE], default: EXPENSE } }
 *       - { in: query, name: date_from, schema: { type: string, format: date } }
 *       - { in: query, name: date_to,   schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Top categories with totals and counts }
 */
router.get('/top-categories', authorize(Role.ANALYST, Role.ADMIN), validate(topCategoriesSchema, 'query'), async (req: AuthRequest, res: Response) => {
  const data = await dashboardService.getTopCategories(req.query as any);
  sendSuccess(res, { categories: data });
});

/**
 * @swagger
 * /dashboard/comparison:
 *   get:
 *     tags: [Dashboard]
 *     summary: Current vs previous month comparison (Analyst, Admin)
 *     responses:
 *       200: { description: Period-over-period comparison with absolute and percentage changes }
 */
router.get('/comparison', authorize(Role.ANALYST, Role.ADMIN), async (_req: AuthRequest, res: Response) => {
  const data = await dashboardService.getComparison();
  sendSuccess(res, data);
});

export default router;
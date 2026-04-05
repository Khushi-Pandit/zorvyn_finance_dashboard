import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { cache, CacheKeys } from '../../cache';
import { config } from '../../config';
import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const dashboardQuerySchema = z.object({
  date_from: z.string().regex(ISO_DATE).optional(),
  date_to:   z.string().regex(ISO_DATE).optional(),
  currency:  z.string().length(3).toUpperCase().default('USD'),
});

export const trendsQuerySchema = z.object({
  period:    z.enum(['monthly', 'weekly']).default('monthly'),
  months:    z.coerce.number().int().min(1).max(24).default(6),
  currency:  z.string().length(3).toUpperCase().default('USD'),
});

export const topCategoriesSchema = z.object({
  limit:     z.coerce.number().int().min(1).max(20).default(5),
  type:      z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
  date_from: z.string().regex(ISO_DATE).optional(),
  date_to:   z.string().regex(ISO_DATE).optional(),
});

export const dashboardService = {
  async getSummary(query: z.infer<typeof dashboardQuerySchema>) {
    const from = query.date_from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to   = query.date_to   || new Date().toISOString().slice(0, 10);

    const cacheKey = CacheKeys.dashboardSummary(from, to);
    const cached   = await cache.get<object>(cacheKey);
    if (cached) return { ...cached, cached: true };

    const where: Prisma.FinancialRecordWhereInput = {
      deletedAt: null,
      date:      { gte: new Date(from), lte: new Date(to) },
    };

    const [incomeAgg, expenseAgg, transferAgg, counts] = await Promise.all([
      prisma.financialRecord.aggregate({ where: { ...where, type: 'INCOME'  }, _sum: { amount: true }, _count: true }),
      prisma.financialRecord.aggregate({ where: { ...where, type: 'EXPENSE' }, _sum: { amount: true }, _count: true }),
      prisma.financialRecord.aggregate({ where: { ...where, type: 'TRANSFER'}, _sum: { amount: true }, _count: true }),
      prisma.financialRecord.count({ where }),
    ]);

    const totalIncome   = Number(incomeAgg._sum.amount   || 0);
    const totalExpenses = Number(expenseAgg._sum.amount  || 0);
    const totalTransfer = Number(transferAgg._sum.amount || 0);

    const result = {
      period:        { from, to },
      totalIncome:   totalIncome.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      totalTransfer: totalTransfer.toFixed(2),
      netBalance:    (totalIncome - totalExpenses).toFixed(2),
      transactionCount: {
        income:   incomeAgg._count,
        expense:  expenseAgg._count,
        transfer: transferAgg._count,
        total:    counts,
      },
      currency:   query.currency,
      cachedAt:   new Date().toISOString(),
      cacheTtlSeconds: config.cache.summaryTtl,
    };

    await cache.set(cacheKey, result, config.cache.summaryTtl);
    return result;
  },

  async getTrends(query: z.infer<typeof trendsQuerySchema>) {
    const cacheKey = CacheKeys.dashboardTrends(query.period, query.months);
    const cached   = await cache.get<object[]>(cacheKey);
    if (cached) return cached;

    const truncUnit = query.period === 'monthly' ? 'month' : 'week';

    // Raw SQL for date_trunc grouping
    const rows = await prisma.$queryRaw<Array<{
      period: Date; type: string; total: number; count: number;
    }>>`
      SELECT
        date_trunc(${truncUnit}, date::timestamptz) AS period,
        type,
        SUM(amount)::float AS total,
        COUNT(*)::int       AS count
      FROM financial_records
      WHERE
        deleted_at IS NULL
        AND date >= (CURRENT_DATE - (${query.months} || ' months')::interval)::date
      GROUP BY 1, 2
      ORDER BY 1 ASC, 2
    `;

    // Group by period
    const periodMap: Record<string, { period: string; income: number; expense: number; transfer: number; incomeCount: number; expenseCount: number }> = {};

    for (const row of rows) {
      const key = new Date(row.period).toISOString().slice(0, 10);
      if (!periodMap[key]) {
        periodMap[key] = { period: key, income: 0, expense: 0, transfer: 0, incomeCount: 0, expenseCount: 0 };
      }
      if (row.type === 'INCOME')   { periodMap[key].income   = row.total; periodMap[key].incomeCount  = row.count; }
      if (row.type === 'EXPENSE')  { periodMap[key].expense  = row.total; periodMap[key].expenseCount = row.count; }
      if (row.type === 'TRANSFER') { periodMap[key].transfer = row.total; }
    }

    const result = Object.values(periodMap).map((p) => ({
      ...p,
      net: (p.income - p.expense).toFixed(2),
      income:  p.income.toFixed(2),
      expense: p.expense.toFixed(2),
    }));

    await cache.set(cacheKey, result, config.cache.trendsTtl);
    return result;
  },

  async getCategoryBreakdown(query: z.infer<typeof dashboardQuerySchema>) {
    const from = query.date_from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to   = query.date_to   || new Date().toISOString().slice(0, 10);

    const cacheKey = CacheKeys.dashboardCategories(from, to);
    const cached   = await cache.get<object[]>(cacheKey);
    if (cached) return cached;

    const rows = await prisma.$queryRaw<Array<{
      categoryId: string | null; categoryName: string | null;
      categoryColor: string | null; type: string;
      total: number; count: number;
    }>>`
      SELECT
        fr.category_id  AS "categoryId",
        c.name          AS "categoryName",
        c.color         AS "categoryColor",
        fr.type,
        SUM(fr.amount)::float AS total,
        COUNT(*)::int          AS count
      FROM financial_records fr
      LEFT JOIN categories c ON c.id = fr.category_id
      WHERE
        fr.deleted_at IS NULL
        AND fr.date BETWEEN ${new Date(from)} AND ${new Date(to)}
      GROUP BY fr.category_id, c.name, c.color, fr.type
      ORDER BY total DESC
    `;

    // Compute totals for percentages
    const grandIncome  = rows.filter((r) => r.type === 'INCOME' ).reduce((s, r) => s + r.total, 0);
    const grandExpense = rows.filter((r) => r.type === 'EXPENSE').reduce((s, r) => s + r.total, 0);

    const result = rows.map((r) => ({
      categoryId:    r.categoryId,
      categoryName:  r.categoryName || 'Uncategorised',
      categoryColor: r.categoryColor,
      type:          r.type,
      total:         r.total.toFixed(2),
      count:         r.count,
      percentage: r.type === 'INCOME'
        ? grandIncome  > 0 ? ((r.total / grandIncome)  * 100).toFixed(1) : '0.0'
        : grandExpense > 0 ? ((r.total / grandExpense) * 100).toFixed(1) : '0.0',
    }));

    await cache.set(cacheKey, result, config.cache.categoriesTtl);
    return result;
  },

  async getRecent(limit = 10) {
    const records = await prisma.financialRecord.findMany({
      where:   { deletedAt: null },
      take:    Math.min(limit, 50),
      orderBy: { date: 'desc' },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });
    return records;
  },

  async getTopCategories(query: z.infer<typeof topCategoriesSchema>) {
    const where: Prisma.FinancialRecordWhereInput = {
      deletedAt: null,
      type:      query.type,
      ...(query.date_from || query.date_to ? {
        date: {
          ...(query.date_from ? { gte: new Date(query.date_from) } : {}),
          ...(query.date_to   ? { lte: new Date(query.date_to)   } : {}),
        },
      } : {}),
    };

    const groups = await prisma.financialRecord.groupBy({
      by:      ['categoryId'],
      where,
      _sum:    { amount: true },
      _count:  true,
      orderBy: { _sum: { amount: 'desc' } },
      take:    query.limit,
    });

    const categoryIds = groups.map((g) => g.categoryId).filter(Boolean) as string[];
    const categories  = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
    const catMap      = Object.fromEntries(categories.map((c) => [c.id, c]));

    return groups.map((g) => ({
      category:   g.categoryId ? catMap[g.categoryId] || null : null,
      total:      Number(g._sum.amount || 0).toFixed(2),
      count:      g._count,
    }));
  },

  async getComparison() {
    const now          = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);

    async function periodTotals(from: Date, to: Date) {
      const [inc, exp] = await Promise.all([
        prisma.financialRecord.aggregate({
          where: { deletedAt: null, type: 'INCOME',  date: { gte: from, lte: to } },
          _sum: { amount: true },
        }),
        prisma.financialRecord.aggregate({
          where: { deletedAt: null, type: 'EXPENSE', date: { gte: from, lte: to } },
          _sum: { amount: true },
        }),
      ]);
      const income   = Number(inc._sum.amount || 0);
      const expenses = Number(exp._sum.amount || 0);
      return { income: income.toFixed(2), expenses: expenses.toFixed(2), net: (income - expenses).toFixed(2) };
    }

    const [current, previous] = await Promise.all([
      periodTotals(thisMonthStart, now),
      periodTotals(prevMonthStart, prevMonthEnd),
    ]);

    const incomeChange  = Number(current.income)   - Number(previous.income);
    const expenseChange = Number(current.expenses) - Number(previous.expenses);

    return {
      current:  { period: { from: thisMonthStart.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }, ...current },
      previous: { period: { from: prevMonthStart.toISOString().slice(0, 10), to: prevMonthEnd.toISOString().slice(0, 10) }, ...previous },
      changes: {
        income:   { absolute: incomeChange.toFixed(2),  pct: previous.income  !== '0.00' ? ((incomeChange  / Number(previous.income))  * 100).toFixed(1) : null },
        expenses: { absolute: expenseChange.toFixed(2), pct: previous.expenses !== '0.00' ? ((expenseChange / Number(previous.expenses)) * 100).toFixed(1) : null },
      },
    };
  },
};
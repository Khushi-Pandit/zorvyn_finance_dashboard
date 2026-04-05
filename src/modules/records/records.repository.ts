import { Prisma, RecordType } from '@prisma/client';
import { prisma } from '../../config/database';
import { getPrismaSkip, buildPaginatedResult } from '../../shared/utils';
import { PaginationQuery } from '../../shared/types';

const RECORD_INCLUDE: Prisma.FinancialRecordInclude = {
  category: { select: { id: true, name: true, type: true, color: true, icon: true } },
  createdBy: { select: { id: true, email: true, fullName: true } },
  lastModifiedBy: { select: { id: true, email: true, fullName: true } },
};

export interface RecordFilterOptions extends PaginationQuery {
  type?:           RecordType;
  categoryId?:     string;
  dateFrom?:       Date;
  dateTo?:         Date;
  minAmount?:      number;
  maxAmount?:      number;
  search?:         string;
  tags?:           string[];
  includeDeleted?: boolean;
  sortBy?:         string;
  sortOrder?:      'asc' | 'desc';
}

function buildWhere(opts: RecordFilterOptions): Prisma.FinancialRecordWhereInput {
  const where: Prisma.FinancialRecordWhereInput = {};

  if (!opts.includeDeleted) where.deletedAt = null;
  if (opts.type)       where.type       = opts.type;
  if (opts.categoryId) where.categoryId = opts.categoryId;

  if (opts.dateFrom || opts.dateTo) {
    where.date = {
      ...(opts.dateFrom ? { gte: opts.dateFrom } : {}),
      ...(opts.dateTo   ? { lte: opts.dateTo   } : {}),
    };
  }

  if (opts.minAmount || opts.maxAmount) {
    where.amount = {
      ...(opts.minAmount ? { gte: opts.minAmount } : {}),
      ...(opts.maxAmount ? { lte: opts.maxAmount } : {}),
    };
  }

  if (opts.search) {
    where.OR = [
      { description:     { contains: opts.search, mode: 'insensitive' } },
      { referenceNumber: { contains: opts.search, mode: 'insensitive' } },
    ];
  }

  if (opts.tags && opts.tags.length > 0) {
    where.tags = { hasEvery: opts.tags };
  }

  return where;
}

function buildOrderBy(sortBy = 'date', sortOrder: 'asc' | 'desc' = 'desc'): Prisma.FinancialRecordOrderByWithRelationInput {
  const fieldMap: Record<string, string> = { date: 'date', amount: 'amount', created_at: 'createdAt' };
  const field = fieldMap[sortBy] || 'date';
  return { [field]: sortOrder };
}

export const recordsRepository = {
  async findMany(opts: RecordFilterOptions) {
    const where   = buildWhere(opts);
    const orderBy = buildOrderBy(opts.sortBy, opts.sortOrder);

    const [records, total] = await Promise.all([
      prisma.financialRecord.findMany({
        where,
        include: RECORD_INCLUDE,
        skip:    getPrismaSkip(opts),
        take:    opts.limit,
        orderBy,
      }),
      prisma.financialRecord.count({ where }),
    ]);

    return buildPaginatedResult(records, total, opts);
  },

  async findById(id: string, includeDeleted = false) {
    return prisma.financialRecord.findFirst({
      where:   { id, ...(includeDeleted ? {} : { deletedAt: null }) },
      include: RECORD_INCLUDE,
    });
  },

  async create(data: {
    amount: number; type: RecordType; date: Date;
    description?: string; referenceNumber?: string;
    currency: string; tags: string[];
    categoryId?: string; createdById: string; lastModifiedById: string;
  }) {
    return prisma.financialRecord.create({
      data:    data as any,
      include: RECORD_INCLUDE,
    });
  },

  async update(id: string, data: Partial<{
    amount: number; type: RecordType; date: Date;
    description: string | null; referenceNumber: string | null;
    currency: string; tags: string[];
    categoryId: string | null; lastModifiedById: string;
  }>) {
    return prisma.financialRecord.update({
      where:   { id },
      data:    data as any,
      include: RECORD_INCLUDE,
    });
  },

  async softDelete(id: string) {
    return prisma.financialRecord.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });
  },

  async restore(id: string) {
    return prisma.financialRecord.update({
      where:   { id },
      data:    { deletedAt: null },
      include: RECORD_INCLUDE,
    });
  },

  async findForExport(opts: {
    type?: RecordType; categoryId?: string;
    dateFrom?: Date; dateTo?: Date;
  }) {
    const where: Prisma.FinancialRecordWhereInput = { deletedAt: null };
    if (opts.type)       where.type       = opts.type;
    if (opts.categoryId) where.categoryId = opts.categoryId;
    if (opts.dateFrom || opts.dateTo) {
      where.date = {
        ...(opts.dateFrom ? { gte: opts.dateFrom } : {}),
        ...(opts.dateTo   ? { lte: opts.dateTo   } : {}),
      };
    }
    return prisma.financialRecord.findMany({
      where,
      include: RECORD_INCLUDE,
      orderBy: { date: 'desc' },
    });
  },
};
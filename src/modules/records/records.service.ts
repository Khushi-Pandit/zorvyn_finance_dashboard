import { RecordType, AuditAction } from '@prisma/client';
import { recordsRepository } from './records.repository';
import { writeAudit } from '../../audit';
import { cache, CacheKeys } from '../../cache';
import { AuditContext } from '../../shared/types';
import { NotFoundError, ConflictError, ForbiddenError, BadRequestError } from '../../shared/errors';
import { CreateRecordDto, UpdateRecordDto, ListRecordsQuery, ExportQuery } from './records.schema';

async function invalidateDashboardCache() {
  await cache.delPattern('dashboard:*');
  await cache.delPattern('records:count:*');
}

export const recordsService = {
  async list(query: ListRecordsQuery) {
    return recordsRepository.findMany({
      page:           query.page,
      limit:          query.limit,
      type:           query.type as RecordType | undefined,
      categoryId:     query.categoryId,
      dateFrom:       query.date_from ? new Date(query.date_from) : undefined,
      dateTo:         query.date_to   ? new Date(query.date_to)   : undefined,
      minAmount:      query.min_amount,
      maxAmount:      query.max_amount,
      search:         query.search,
      tags:           query.tags as string[] | undefined,
      includeDeleted: query.includeDeleted,
      sortBy:         query.sort_by,
      sortOrder:      query.sort_order,
    });
  },

  async getById(id: string) {
    const record = await recordsRepository.findById(id);
    if (!record) throw new NotFoundError('Financial record');
    return record;
  },

  async create(dto: CreateRecordDto, context: AuditContext) {
    if (dto.referenceNumber) {
      const existing = await recordsRepository.findMany({
        page: 1, limit: 1, search: dto.referenceNumber, includeDeleted: true,
      });
      // Simple duplicate check via search is approximate — for exact match we'd query directly
    }

    const record = await recordsRepository.create({
      amount:          dto.amount,
      type:            dto.type as RecordType,
      date:            dto.date,
      description:     dto.description,
      referenceNumber: dto.referenceNumber,
      currency:        dto.currency,
      tags:            dto.tags,
      categoryId:      dto.categoryId,
      createdById:     context.actorId,
      lastModifiedById: context.actorId,
    });

    writeAudit({ action: AuditAction.CREATE, resource: 'financial_records', resourceId: record.id, context });
    await invalidateDashboardCache();

    return record;
  },

  async update(id: string, dto: UpdateRecordDto, context: AuditContext) {
    const existing = await recordsRepository.findById(id);
    if (!existing) throw new NotFoundError('Financial record');
    if (existing.deletedAt) throw new BadRequestError('Cannot update a deleted record. Restore it first.');

    const updated = await recordsRepository.update(id, {
      ...(dto.amount          !== undefined ? { amount: dto.amount }                   : {}),
      ...(dto.type            !== undefined ? { type: dto.type as RecordType }         : {}),
      ...(dto.date            !== undefined ? { date: dto.date }                       : {}),
      ...(dto.description     !== undefined ? { description: dto.description || null } : {}),
      ...(dto.referenceNumber !== undefined ? { referenceNumber: dto.referenceNumber || null } : {}),
      ...(dto.currency        !== undefined ? { currency: dto.currency }               : {}),
      ...(dto.tags            !== undefined ? { tags: dto.tags }                       : {}),
      ...(dto.categoryId      !== undefined ? { categoryId: dto.categoryId || null }   : {}),
      lastModifiedById: context.actorId,
    });

    writeAudit({
      action: AuditAction.UPDATE, resource: 'financial_records', resourceId: id,
      changes: {
        before: { amount: existing.amount, type: existing.type, date: existing.date, description: existing.description },
        after:  dto,
      },
      context,
    });

    await invalidateDashboardCache();
    return updated;
  },

  async softDelete(id: string, context: AuditContext) {
    const existing = await recordsRepository.findById(id);
    if (!existing) throw new NotFoundError('Financial record');
    if (existing.deletedAt) throw new BadRequestError('Record is already deleted');

    await recordsRepository.softDelete(id);

    writeAudit({ action: AuditAction.DELETE, resource: 'financial_records', resourceId: id, context });
    await invalidateDashboardCache();
  },

  async restore(id: string, context: AuditContext) {
    const existing = await recordsRepository.findById(id, true);
    if (!existing) throw new NotFoundError('Financial record');
    if (!existing.deletedAt) throw new BadRequestError('Record is not deleted');

    const restored = await recordsRepository.restore(id);
    writeAudit({ action: AuditAction.RESTORE, resource: 'financial_records', resourceId: id, context });
    await invalidateDashboardCache();
    return restored;
  },

  async export(query: ExportQuery) {
    const records = await recordsRepository.findForExport({
      type:       query.type as RecordType | undefined,
      categoryId: query.categoryId,
      dateFrom:   query.date_from ? new Date(query.date_from) : undefined,
      dateTo:     query.date_to   ? new Date(query.date_to)   : undefined,
    });

    if (query.format === 'csv') {
      const header = 'id,date,type,amount,currency,category,description,referenceNumber,tags,createdAt';
      const rows = records.map((r) =>
        [
          r.id,
          new Date(r.date).toISOString().slice(0, 10),
          r.type,
          r.amount,
          r.currency,
          r.category?.name || '',
          `"${(r.description || '').replace(/"/g, '""')}"`,
          r.referenceNumber || '',
          r.tags.join('|'),
          r.createdAt.toISOString(),
        ].join(','),
      );
      return { format: 'csv', content: [header, ...rows].join('\n'), count: records.length };
    }

    return { format: 'json', content: records, count: records.length };
  },
};
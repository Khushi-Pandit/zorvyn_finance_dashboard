import { AuditAction } from '@prisma/client';
import { prisma } from '../config/database';
import { AuditContext } from '../shared/types';
import { logger } from '../config/logger';

interface WriteAuditParams {
  action: AuditAction;
  resource: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  context: AuditContext;
}

/**
 * Append-only audit log writer.
 * Fires asynchronously and never throws — audit failures must not disrupt the main flow.
 */
export function writeAudit(params: WriteAuditParams): void {
  // Fire-and-forget with error swallowing
  prisma.auditLog
    .create({
      data: {
        actorId:    params.context.actorId,
        action:     params.action,
        resource:   params.resource,
        resourceId: params.resourceId,
        changes:    params.changes ? JSON.parse(JSON.stringify(params.changes)) : undefined,
        ipAddress:  params.context.ipAddress,
        userAgent:  params.context.userAgent,
      },
    })
    .catch((err) => {
      logger.error('Failed to write audit log', {
        error: err.message,
        action: params.action,
        resource: params.resource,
      });
    });
}

export const auditService = {
  async list(params: {
    actorId?: string;
    action?: AuditAction;
    resource?: string;
    resourceId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page: number;
    limit: number;
  }) {
    const where: Record<string, unknown> = {};
    if (params.actorId)    where.actorId  = params.actorId;
    if (params.action)     where.action   = params.action;
    if (params.resource)   where.resource = params.resource;
    if (params.resourceId) where.resourceId = params.resourceId;

    if (params.dateFrom || params.dateTo) {
      where.createdAt = {
        ...(params.dateFrom ? { gte: params.dateFrom } : {}),
        ...(params.dateTo   ? { lte: params.dateTo   } : {}),
      };
    }

    const skip = (params.page - 1) * params.limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, email: true, fullName: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  },

  async forRecord(recordId: string) {
    return prisma.auditLog.findMany({
      where: { resource: 'financial_records', resourceId: recordId },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, email: true, fullName: true, role: true } },
      },
    });
  },
};
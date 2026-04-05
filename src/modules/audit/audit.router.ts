import { Router, Response } from 'express';
import { z } from 'zod';
import { AuditAction } from '@prisma/client';
import { auditService } from '../../audit';
import { AuthRequest } from '../../shared/types';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { sendSuccess } from '../../shared/utils';
import { buildPaginatedResult } from '../../shared/utils';
import { Role } from '@prisma/client';

const listAuditSchema = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
  actorId:    z.string().uuid().optional(),
  action:     z.nativeEnum(AuditAction).optional(),
  resource:   z.string().max(50).optional(),
  resourceId: z.string().uuid().optional(),
  date_from:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const router = Router();
router.use(authenticate, authorize(Role.ADMIN));

/**
 * @swagger
 * /audit-logs:
 *   get:
 *     tags: [Audit]
 *     summary: Paginated audit log with filters (Admin)
 *     parameters:
 *       - { in: query, name: page,       schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit,      schema: { type: integer, default: 20 } }
 *       - { in: query, name: actorId,    schema: { type: string, format: uuid } }
 *       - { in: query, name: action,     schema: { type: string, enum: [CREATE, UPDATE, DELETE, RESTORE, LOGIN, LOGOUT, ROLE_CHANGE, STATUS_CHANGE, PASSWORD_CHANGE] } }
 *       - { in: query, name: resource,   schema: { type: string }, description: 'e.g. financial_records, users' }
 *       - { in: query, name: resourceId, schema: { type: string, format: uuid } }
 *       - { in: query, name: date_from,  schema: { type: string, format: date } }
 *       - { in: query, name: date_to,    schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Paginated audit log entries with actor details }
 *       403: { description: Admin role required }
 */
router.get('/', validate(listAuditSchema, 'query'), async (req: AuthRequest, res: Response) => {
  const q      = req.query as unknown as z.infer<typeof listAuditSchema>;
  const { logs, total } = await auditService.list({
    page:       q.page,
    limit:      q.limit,
    actorId:    q.actorId,
    action:     q.action,
    resource:   q.resource,
    resourceId: q.resourceId,
    dateFrom:   q.date_from ? new Date(q.date_from) : undefined,
    dateTo:     q.date_to   ? new Date(q.date_to)   : undefined,
  });

  const result = buildPaginatedResult(logs, total, { page: q.page, limit: q.limit });
  res.status(200).json({ success: true, data: result.data, meta: result.meta });
});

/**
 * @swagger
 * /audit-logs/records/{id}:
 *   get:
 *     tags: [Audit]
 *     summary: Full change history for a specific financial record (Admin)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Chronological audit history for the record }
 */
router.get('/records/:id', async (req: AuthRequest, res: Response) => {
  const logs = await auditService.forRecord(req.params.id);
  sendSuccess(res, { logs, count: logs.length });
});

export default router;
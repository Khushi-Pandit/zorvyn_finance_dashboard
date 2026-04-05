import { Router } from 'express';
import { recordsController } from './records.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { Role } from '@prisma/client';
import {
  createRecordSchema, updateRecordSchema,
  listRecordsSchema, exportQuerySchema,
} from './records.schema';

const router = Router();

// All record routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /records:
 *   get:
 *     tags: [Records]
 *     summary: List financial records with full filtering, sorting & pagination
 *     parameters:
 *       - { in: query, name: page,           schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit,          schema: { type: integer, default: 20, maximum: 100 } }
 *       - { in: query, name: type,           schema: { type: string, enum: [INCOME, EXPENSE, TRANSFER] } }
 *       - { in: query, name: categoryId,     schema: { type: string, format: uuid } }
 *       - { in: query, name: date_from,      schema: { type: string, format: date } }
 *       - { in: query, name: date_to,        schema: { type: string, format: date } }
 *       - { in: query, name: min_amount,     schema: { type: number } }
 *       - { in: query, name: max_amount,     schema: { type: number } }
 *       - { in: query, name: search,         schema: { type: string }, description: 'Search description or reference number' }
 *       - { in: query, name: tags,           schema: { type: array, items: { type: string } } }
 *       - { in: query, name: sort_by,        schema: { type: string, enum: [date, amount, created_at], default: date } }
 *       - { in: query, name: sort_order,     schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { in: query, name: includeDeleted, schema: { type: boolean }, description: 'Admin only' }
 *     responses:
 *       200:
 *         description: Paginated list of financial records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/FinancialRecord' } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 */
router.get('/', validate(listRecordsSchema, 'query'), recordsController.list);

/**
 * @swagger
 * /records/export:
 *   get:
 *     tags: [Records]
 *     summary: Export records as JSON or CSV (Analyst, Admin)
 *     parameters:
 *       - { in: query, name: format,     schema: { type: string, enum: [json, csv], default: json } }
 *       - { in: query, name: date_from,  schema: { type: string, format: date } }
 *       - { in: query, name: date_to,    schema: { type: string, format: date } }
 *       - { in: query, name: type,       schema: { type: string, enum: [INCOME, EXPENSE, TRANSFER] } }
 *       - { in: query, name: categoryId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Records in requested format }
 *       403: { description: Analyst or Admin role required }
 */
router.get(
  '/export',
  authorize(Role.ANALYST, Role.ADMIN),
  validate(exportQuerySchema, 'query'),
  recordsController.export,
);

/**
 * @swagger
 * /records/{id}:
 *   get:
 *     tags: [Records]
 *     summary: Get a single financial record
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Financial record with category and creator details }
 *       404: { description: Record not found }
 */
router.get('/:id', recordsController.getById);

/**
 * @swagger
 * /records:
 *   post:
 *     tags: [Records]
 *     summary: Create a financial record (Admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, type, date]
 *             properties:
 *               amount:          { type: number, example: 1500.00 }
 *               type:            { type: string, enum: [INCOME, EXPENSE, TRANSFER] }
 *               date:            { type: string, format: date, example: '2026-04-01' }
 *               description:     { type: string, maxLength: 2000 }
 *               referenceNumber: { type: string, maxLength: 100 }
 *               currency:        { type: string, example: 'USD' }
 *               tags:            { type: array, items: { type: string } }
 *               categoryId:      { type: string, format: uuid }
 *     responses:
 *       201: { description: Record created; dashboard cache invalidated }
 *       403: { description: Admin role required }
 *       422: { description: Validation error }
 */
router.post('/', authorize(Role.ADMIN), validate(createRecordSchema), recordsController.create);

/**
 * @swagger
 * /records/{id}:
 *   patch:
 *     tags: [Records]
 *     summary: Update a financial record (Admin)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated record; audit diff saved }
 *       400: { description: Record is soft-deleted }
 *       403: { description: Admin role required }
 *       404: { description: Record not found }
 */
router.patch('/:id', authorize(Role.ADMIN), validate(updateRecordSchema), recordsController.update);

/**
 * @swagger
 * /records/{id}:
 *   delete:
 *     tags: [Records]
 *     summary: Soft-delete a financial record (Admin)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       204: { description: Record soft-deleted }
 *       403: { description: Admin role required }
 *       404: { description: Record not found }
 */
router.delete('/:id', authorize(Role.ADMIN), recordsController.softDelete);

/**
 * @swagger
 * /records/{id}/restore:
 *   post:
 *     tags: [Records]
 *     summary: Restore a soft-deleted record (Admin)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Record restored }
 *       400: { description: Record is not deleted }
 *       403: { description: Admin role required }
 */
router.post('/:id/restore', authorize(Role.ADMIN), recordsController.restore);

export default router;
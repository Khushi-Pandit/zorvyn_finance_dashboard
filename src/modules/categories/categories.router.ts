import { Router, Response } from 'express';
import { categoriesService } from './categories.service';
import { AuthRequest } from '../../shared/types';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { sendSuccess } from '../../shared/utils';
import { Role } from '@prisma/client';
import {
  createCategorySchema,
  updateCategorySchema,
  listCategoriesSchema,
} from './categories.schema';

// ─── Controller ───────────────────────────────────────────────────────────────

function ctx(req: AuthRequest) {
  return {
    actorId:   req.user!.sub,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || undefined,
    userAgent: req.headers['user-agent'] || undefined,
  };
}

const categoriesController = {
  async list(req: AuthRequest, res: Response) {
    const categories = await categoriesService.list(req.query as any);
    sendSuccess(res, { categories, count: (categories as any[]).length });
  },

  async getById(req: AuthRequest, res: Response) {
    const category = await categoriesService.getById(req.params.id);
    sendSuccess(res, { category });
  },

  async create(req: AuthRequest, res: Response) {
    const category = await categoriesService.create(req.body, ctx(req));
    sendSuccess(res, { category }, 201);
  },

  async update(req: AuthRequest, res: Response) {
    const category = await categoriesService.update(req.params.id, req.body, ctx(req));
    sendSuccess(res, { category });
  },

  async delete(req: AuthRequest, res: Response) {
    await categoriesService.delete(req.params.id, ctx(req));
    res.status(204).send();
  },
};

// ─── Router ───────────────────────────────────────────────────────────────────

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: List all categories (All roles)
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [INCOME, EXPENSE, BOTH] }
 *       - in: query
 *         name: withCounts
 *         schema: { type: boolean, default: false }
 *         description: Include record counts per category
 *     responses:
 *       200: { description: List of categories }
 */
router.get('/', validate(listCategoriesSchema, 'query'), categoriesController.list);

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     tags: [Categories]
 *     summary: Get category by ID (All roles)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Category details }
 *       404: { description: Category not found }
 */
router.get('/:id', categoriesController.getById);

/**
 * @swagger
 * /categories:
 *   post:
 *     tags: [Categories]
 *     summary: Create a custom category (Admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name:  { type: string, maxLength: 80 }
 *               type:  { type: string, enum: [INCOME, EXPENSE, BOTH] }
 *               color: { type: string, pattern: '^#[0-9A-Fa-f]{6}$', example: '#3B82F6' }
 *               icon:  { type: string, maxLength: 50 }
 *     responses:
 *       201: { description: Category created }
 *       409: { description: Name already exists }
 */
router.post('/', authorize(Role.ADMIN), validate(createCategorySchema), categoriesController.create);

/**
 * @swagger
 * /categories/{id}:
 *   patch:
 *     tags: [Categories]
 *     summary: Update a category (Admin)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated category }
 *       409: { description: Name conflict }
 */
router.patch('/:id', authorize(Role.ADMIN), validate(updateCategorySchema), categoriesController.update);

/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     tags: [Categories]
 *     summary: Delete a custom category (Admin)
 *     description: |
 *       Fails if the category is a system category or has records assigned to it.
 *       Reassign or delete linked records first.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       204: { description: Category deleted }
 *       400: { description: System category or has linked records }
 */
router.delete('/:id', authorize(Role.ADMIN), categoriesController.delete);

export default router;
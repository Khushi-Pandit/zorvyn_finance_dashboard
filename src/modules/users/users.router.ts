import { Router } from 'express';
import { usersController } from './users.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { Role } from '@prisma/client';
import {
  createUserSchema, updateUserSchema,
  updateRoleSchema, updateStatusSchema, listUsersSchema,
} from './users.schema';

const router = Router();

// All user management requires Admin role
router.use(authenticate, authorize(Role.ADMIN));

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List all users (Admin)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [VIEWER, ANALYST, ADMIN] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE, SUSPENDED] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by email or full name
 *     responses:
 *       200: { description: Paginated list of users }
 *       403: { description: Admin role required }
 */
router.get('/', validate(listUsersSchema, 'query'), usersController.list);

/**
 * @swagger
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Create a new user (Admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, fullName]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               fullName: { type: string }
 *               role:     { type: string, enum: [VIEWER, ANALYST, ADMIN], default: VIEWER }
 *     responses:
 *       201: { description: User created }
 *       409: { description: Email already exists }
 */
router.post('/', validate(createUserSchema), usersController.create);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID (Admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: User details }
 *       404: { description: User not found }
 */
router.get('/:id', usersController.getById);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Update user details (Admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               email:    { type: string, format: email }
 *     responses:
 *       200: { description: Updated user }
 */
router.patch('/:id', validate(updateUserSchema), usersController.update);

/**
 * @swagger
 * /users/{id}/role:
 *   patch:
 *     tags: [Users]
 *     summary: Change user role (Admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [VIEWER, ANALYST, ADMIN] }
 *     responses:
 *       200: { description: Role updated; audit log written }
 *       400: { description: Cannot change own role }
 */
router.patch('/:id/role', validate(updateRoleSchema), usersController.updateRole);

/**
 * @swagger
 * /users/{id}/status:
 *   patch:
 *     tags: [Users]
 *     summary: Change user status (Admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [ACTIVE, INACTIVE, SUSPENDED] }
 *     responses:
 *       200: { description: Status updated }
 */
router.patch('/:id/status', validate(updateStatusSchema), usersController.updateStatus);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Soft-delete a user (Admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: User soft-deleted }
 *       403: { description: Cannot delete own account }
 */
router.delete('/:id', usersController.softDelete);

export default router;
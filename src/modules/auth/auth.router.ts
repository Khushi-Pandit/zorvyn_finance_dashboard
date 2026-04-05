import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { registerSchema, loginSchema, changePasswordSchema } from './auth.schema';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, fullName]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string, minLength: 8, description: 'Min 8 chars, 1 uppercase, 1 digit, 1 special' }
 *               fullName: { type: string }
 *               role:     { type: string, enum: [VIEWER, ANALYST, ADMIN] }
 *     responses:
 *       201: { description: User created }
 *       409: { description: Email already exists }
 *       422: { description: Validation error }
 */
router.post('/register', authRateLimiter, validate(registerSchema), authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate and receive tokens
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Returns accessToken; sets HttpOnly refreshToken cookie }
 *       401: { description: Invalid credentials }
 *       403: { description: Account inactive/suspended }
 */
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh token and get new access token
 *     security: []
 *     responses:
 *       200: { description: New accessToken issued; refreshToken cookie rotated }
 *       401: { description: Invalid or expired refresh token }
 */
router.post('/refresh', authController.refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke refresh token and clear cookie
 *     responses:
 *       204: { description: Logged out successfully }
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user profile
 *     responses:
 *       200: { description: User profile }
 *       401: { description: Not authenticated }
 */
router.get('/me', authenticate, authController.me);

/**
 * @swagger
 * /auth/me/password:
 *   patch:
 *     tags: [Auth]
 *     summary: Change own password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword:     { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password changed; all sessions invalidated }
 *       400: { description: Incorrect current password }
 */
router.patch('/me/password', authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;
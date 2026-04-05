import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { config } from '../../config';
import { generateToken, hashToken, sanitizeEmail } from '../../shared/utils';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from '../../shared/errors';
import { JwtPayload, Role } from '../../shared/types';
import { writeAudit } from '../../audit';
import { AuditAction, UserStatus } from '@prisma/client';
import { RegisterDto, LoginDto, ChangePasswordDto } from './auth.schema';

function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtlSeconds,
  });
}

const SAFE_USER_SELECT = {
  id: true, email: true, fullName: true,
  role: true, status: true, lastLoginAt: true,
  createdAt: true, updatedAt: true,
};

export const authService = {
  async register(dto: RegisterDto, context: { ipAddress?: string; userAgent?: string }) {
    const existing = await prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    if (existing) throw new ConflictError('An account with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, config.bcrypt.cost);

    const user = await prisma.user.create({
      data: {
        email:        dto.email,
        passwordHash,
        fullName:     dto.fullName,
        role:         (dto.role as Role) || Role.VIEWER,
        status:       UserStatus.ACTIVE,
      },
      select: SAFE_USER_SELECT,
    });

    writeAudit({
      action: AuditAction.CREATE,
      resource: 'users',
      resourceId: user.id,
      context: { actorId: user.id, ...context },
    });

    return user;
  },

  async login(dto: LoginDto, context: { ipAddress?: string; userAgent?: string }) {
    const user = await prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    if (!user) throw new UnauthorizedError('Invalid email or password');
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError(`Account is ${user.status.toLowerCase()}. Contact an administrator.`);
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedError('Invalid email or password');

    // Issue tokens
    const accessToken  = signAccessToken({ sub: user.id, email: user.email, role: user.role as Role });
    const refreshToken = generateToken(64);
    const tokenHash    = hashToken(refreshToken);
    const expiresAt    = new Date(Date.now() + config.jwt.refreshTtlDays * 86400 * 1000);

    await Promise.all([
      prisma.refreshToken.create({
        data: { userId: user.id, tokenHash, expiresAt, ipAddress: context.ipAddress, userAgent: context.userAgent },
      }),
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    ]);

    writeAudit({ action: AuditAction.LOGIN, resource: 'users', resourceId: user.id, context: { actorId: user.id, ...context } });

    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, accessToken, refreshToken };
  },

  async refresh(rawToken: string, context: { ipAddress?: string; userAgent?: string }) {
    const tokenHash = hashToken(rawToken);
    const stored    = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // If found but already revoked → possible reuse attack → revoke entire family
      if (stored && stored.revokedAt) {
        await prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data:  { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    if (stored.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('Account is not active');
    }

    // Rotate: revoke old, issue new
    const newRaw    = generateToken(64);
    const newHash   = hashToken(newRaw);
    const expiresAt = new Date(Date.now() + config.jwt.refreshTtlDays * 86400 * 1000);

    await prisma.$transaction([
      prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
      prisma.refreshToken.create({
        data: { userId: stored.userId, tokenHash: newHash, expiresAt, ipAddress: context.ipAddress, userAgent: context.userAgent },
      }),
    ]);

    const accessToken = signAccessToken({
      sub:   stored.user.id,
      email: stored.user.email,
      role:  stored.user.role as Role,
    });

    return { accessToken, refreshToken: newRaw };
  },

  async logout(rawToken: string, actorId: string, context: { ipAddress?: string; userAgent?: string }) {
    const tokenHash = hashToken(rawToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
    writeAudit({ action: AuditAction.LOGOUT, resource: 'users', resourceId: actorId, context: { actorId, ...context } });
  },

  async getMe(userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new NotFoundError('User');
    return user;
  },

  async changePassword(userId: string, dto: ChangePasswordDto, context: { ipAddress?: string; userAgent?: string }) {
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundError('User');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestError('Current password is incorrect');

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestError('New password must differ from current password');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, config.bcrypt.cost);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Revoke all refresh tokens on password change
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    });

    writeAudit({ action: AuditAction.PASSWORD_CHANGE, resource: 'users', resourceId: userId, context: { actorId: userId, ...context } });
  },
};
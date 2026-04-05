import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AuthRequest } from '../shared/types';
import { UnauthorizedError, ForbiddenError } from '../shared/errors';

/**
 * Role-based access control guard.
 * Usage: router.get('/route', authenticate, authorize(Role.ADMIN, Role.ANALYST), controller)
 */
export function authorize(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Role '${req.user.role}' is not permitted to perform this action. Required: ${roles.join(' or ')}`,
        ),
      );
    }

    next();
  };
}

/**
 * Self-or-admin guard — allows users to access their own resources, or admins any resource.
 * Usage: router.get('/users/:id', authenticate, selfOrAdmin('id'), controller)
 */
export function selfOrAdmin(paramKey = 'id') {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }

    const targetId = req.params[paramKey];
    const isSelf   = req.user.sub === targetId;
    const isAdmin  = req.user.role === Role.ADMIN;

    if (!isSelf && !isAdmin) {
      return next(new ForbiddenError('You can only access your own resources'));
    }

    next();
  };
}
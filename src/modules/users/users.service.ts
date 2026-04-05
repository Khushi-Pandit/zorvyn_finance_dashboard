import bcrypt from 'bcryptjs';
import { Role, UserStatus, AuditAction } from '@prisma/client';
import { usersRepository } from './users.repository';
import { config } from '../../config';
import { writeAudit } from '../../audit';
import { AuditContext } from '../../shared/types';
import {
  NotFoundError, ConflictError, BadRequestError, ForbiddenError,
} from '../../shared/errors';
import {
  CreateUserDto, UpdateUserDto, UpdateRoleDto,
  UpdateStatusDto, ListUsersQuery,
} from './users.schema';

export const usersService = {
  async list(query: ListUsersQuery) {
    return usersRepository.findMany({
      page:   query.page,
      limit:  query.limit,
      role:   query.role as Role | undefined,
      status: query.status as UserStatus | undefined,
      search: query.search,
    });
  },

  async getById(id: string) {
    const user = await usersRepository.findById(id);
    if (!user) throw new NotFoundError('User');
    return user;
  },

  async create(dto: CreateUserDto, context: AuditContext) {
    const existing = await usersRepository.findByEmail(dto.email);
    if (existing) throw new ConflictError('An account with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, config.bcrypt.cost);
    const user = await usersRepository.create({
      email: dto.email, passwordHash, fullName: dto.fullName,
      role: dto.role as Role,
    });

    writeAudit({ action: AuditAction.CREATE, resource: 'users', resourceId: user.id, context });
    return user;
  },

  async update(id: string, dto: UpdateUserDto, context: AuditContext) {
    const existing = await usersRepository.findById(id);
    if (!existing) throw new NotFoundError('User');

    if (dto.email && dto.email !== existing.email) {
      const conflict = await usersRepository.findByEmail(dto.email);
      if (conflict) throw new ConflictError('Email is already in use');
    }

    const user = await usersRepository.update(id, dto);
    writeAudit({ action: AuditAction.UPDATE, resource: 'users', resourceId: id, changes: { before: existing, after: dto }, context });
    return user;
  },

  async updateRole(id: string, dto: UpdateRoleDto, context: AuditContext) {
    const existing = await usersRepository.findById(id);
    if (!existing) throw new NotFoundError('User');

    if (id === context.actorId) throw new BadRequestError('You cannot change your own role');

    const user = await usersRepository.updateRole(id, dto.role as Role);
    writeAudit({
      action: AuditAction.ROLE_CHANGE, resource: 'users', resourceId: id,
      changes: { before: { role: (existing as any).role }, after: { role: dto.role } },
      context,
    });
    return user;
  },

  async updateStatus(id: string, dto: UpdateStatusDto, context: AuditContext) {
    const existing = await usersRepository.findById(id);
    if (!existing) throw new NotFoundError('User');

    if (id === context.actorId) throw new BadRequestError('You cannot change your own status');

    const user = await usersRepository.updateStatus(id, dto.status as UserStatus);
    writeAudit({
      action: AuditAction.STATUS_CHANGE, resource: 'users', resourceId: id,
      changes: { before: { status: (existing as any).status }, after: { status: dto.status } },
      context,
    });
    return user;
  },

  async softDelete(id: string, context: AuditContext) {
    const existing = await usersRepository.findById(id);
    if (!existing) throw new NotFoundError('User');

    if (id === context.actorId) throw new ForbiddenError('You cannot delete your own account');

    const recordCount = await usersRepository.countRecords(id);
    const user = await usersRepository.softDelete(id);

    writeAudit({
      action: AuditAction.DELETE, resource: 'users', resourceId: id,
      changes: { recordsOwned: recordCount },
      context,
    });
    return user;
  },
};
import { Prisma, Role, UserStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { getPrismaSkip, buildPaginatedResult } from '../../shared/utils';
import { PaginationQuery } from '../../shared/types';

const SAFE_SELECT: Prisma.UserSelect = {
  id: true, email: true, fullName: true,
  role: true, status: true,
  lastLoginAt: true, createdAt: true, updatedAt: true,
};

interface FindManyOptions extends PaginationQuery {
  role?:   Role;
  status?: UserStatus;
  search?: string;
}

export const usersRepository = {
  async findMany(opts: FindManyOptions) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(opts.role   ? { role:   opts.role   } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.search ? {
        OR: [
          { email:    { contains: opts.search, mode: 'insensitive' } },
          { fullName: { contains: opts.search, mode: 'insensitive' } },
        ],
      } : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: SAFE_SELECT,
        skip:   getPrismaSkip(opts),
        take:   opts.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(users, total, opts);
  },

  async findById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: SAFE_SELECT,
    });
  },

  async findByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  },

  async create(data: {
    email: string; passwordHash: string; fullName: string;
    role: Role; status?: UserStatus;
  }) {
    return prisma.user.create({
      data:   { ...data, status: data.status || UserStatus.ACTIVE },
      select: SAFE_SELECT,
    });
  },

  async update(id: string, data: Partial<{ email: string; fullName: string }>) {
    return prisma.user.update({
      where:  { id },
      data:   { ...data, updatedAt: new Date() },
      select: SAFE_SELECT,
    });
  },

  async updateRole(id: string, role: Role) {
    return prisma.user.update({
      where:  { id },
      data:   { role, updatedAt: new Date() },
      select: SAFE_SELECT,
    });
  },

  async updateStatus(id: string, status: UserStatus) {
    return prisma.user.update({
      where:  { id },
      data:   { status, updatedAt: new Date() },
      select: SAFE_SELECT,
    });
  },

  async softDelete(id: string) {
    return prisma.user.update({
      where:  { id },
      data:   { deletedAt: new Date() },
      select: SAFE_SELECT,
    });
  },

  async countRecords(userId: string): Promise<number> {
    return prisma.financialRecord.count({
      where: { createdById: userId, deletedAt: null },
    });
  },
};
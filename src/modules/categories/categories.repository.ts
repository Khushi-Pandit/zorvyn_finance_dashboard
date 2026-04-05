import { CategoryType } from '@prisma/client';
import { prisma } from '../../config/database';

export const categoriesRepository = {
  async findAll(opts: { type?: CategoryType; withCounts?: boolean }) {
    const where = opts.type ? { type: opts.type } : {};

    if (opts.withCounts) {
      return prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { records: { where: { deletedAt: null } } } },
        },
      });
    }

    return prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  },

  async findById(id: string) {
    return prisma.category.findUnique({ where: { id } });
  },

  async findByName(name: string) {
    return prisma.category.findUnique({ where: { name } });
  },

  async create(data: {
    name: string;
    type: CategoryType;
    color?: string;
    icon?: string;
  }) {
    return prisma.category.create({ data });
  },

  async update(
    id: string,
    data: Partial<{ name: string; type: CategoryType; color: string; icon: string }>,
  ) {
    return prisma.category.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.category.delete({ where: { id } });
  },

  async countRecords(id: string): Promise<number> {
    return prisma.financialRecord.count({
      where: { categoryId: id, deletedAt: null },
    });
  },
};
import { CategoryType, AuditAction } from '@prisma/client';
import { categoriesRepository } from './categories.repository';
import { cache, CacheKeys } from '../../cache';
import { config } from '../../config';
import { writeAudit } from '../../audit';
import { AuditContext } from '../../shared/types';
import { NotFoundError, ConflictError, BadRequestError } from '../../shared/errors';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  ListCategoriesQuery,
} from './categories.schema';

export const categoriesService = {
  async list(query: ListCategoriesQuery) {
    // Only cache the plain list (not with counts — those vary)
    if (!query.withCounts) {
      const cacheKey = CacheKeys.categoriesList();
      const cached   = await cache.get<unknown[]>(cacheKey);
      if (cached) return cached;

      const categories = await categoriesRepository.findAll({
        type: query.type as CategoryType | undefined,
      });
      await cache.set(cacheKey, categories, config.cache.categoriesTtl);
      return categories;
    }

    return categoriesRepository.findAll({
      type:       query.type as CategoryType | undefined,
      withCounts: true,
    });
  },

  async getById(id: string) {
    const cat = await categoriesRepository.findById(id);
    if (!cat) throw new NotFoundError('Category');
    return cat;
  },

  async create(dto: CreateCategoryDto, context: AuditContext) {
    const existing = await categoriesRepository.findByName(dto.name);
    if (existing) throw new ConflictError(`Category '${dto.name}' already exists`);

    const category = await categoriesRepository.create({
      name:  dto.name,
      type:  dto.type as CategoryType,
      color: dto.color,
      icon:  dto.icon,
    });

    writeAudit({
      action:     AuditAction.CREATE,
      resource:   'categories',
      resourceId: category.id,
      context,
    });

    await cache.del(CacheKeys.categoriesList());
    return category;
  },

  async update(id: string, dto: UpdateCategoryDto, context: AuditContext) {
    const existing = await categoriesRepository.findById(id);
    if (!existing) throw new NotFoundError('Category');

    if (dto.name && dto.name !== existing.name) {
      const conflict = await categoriesRepository.findByName(dto.name);
      if (conflict) throw new ConflictError(`Category '${dto.name}' already exists`);
    }

    const category = await categoriesRepository.update(id, {
      ...(dto.name  !== undefined ? { name:  dto.name                         } : {}),
      ...(dto.type  !== undefined ? { type:  dto.type as CategoryType         } : {}),
      ...(dto.color !== undefined ? { color: dto.color                        } : {}),
      ...(dto.icon  !== undefined ? { icon:  dto.icon                         } : {}),
    });

    writeAudit({
      action:     AuditAction.UPDATE,
      resource:   'categories',
      resourceId: id,
      changes:    { before: existing, after: dto },
      context,
    });

    await cache.del(CacheKeys.categoriesList());
    await cache.delPattern('dashboard:categories:*');
    return category;
  },

  async delete(id: string, context: AuditContext) {
    const existing = await categoriesRepository.findById(id);
    if (!existing) throw new NotFoundError('Category');

    if (existing.isSystem) {
      throw new BadRequestError('System categories cannot be deleted');
    }

    const recordCount = await categoriesRepository.countRecords(id);
    if (recordCount > 0) {
      throw new BadRequestError(
        `Cannot delete category '${existing.name}' — it is assigned to ${recordCount} record(s). ` +
        `Reassign or delete those records first.`,
      );
    }

    await categoriesRepository.delete(id);

    writeAudit({
      action:     AuditAction.DELETE,
      resource:   'categories',
      resourceId: id,
      changes:    { name: existing.name },
      context,
    });

    await cache.del(CacheKeys.categoriesList());
    await cache.delPattern('dashboard:categories:*');
  },
};
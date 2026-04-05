import { z } from 'zod';

export const createCategorySchema = z.object({
  name:  z.string().min(2).max(80).trim(),
  type:  z.enum(['INCOME', 'EXPENSE', 'BOTH']),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code (#RRGGBB)')
    .optional(),
  icon: z.string().max(50).trim().optional(),
});

export const updateCategorySchema = createCategorySchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' });

export const listCategoriesSchema = z.object({
  type:         z.enum(['INCOME', 'EXPENSE', 'BOTH']).optional(),
  withCounts:   z.coerce.boolean().default(false),
});

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesSchema>;
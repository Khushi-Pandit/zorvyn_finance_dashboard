import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const createRecordSchema = z.object({
  amount: z
    .number({ required_error: 'Amount is required' })
    .positive('Amount must be positive')
    .max(999_999_999_999.99, 'Amount too large')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  type:            z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  date:            z.string().regex(ISO_DATE, 'Date must be YYYY-MM-DD').transform((v) => new Date(v)),
  description:     z.string().max(2000).trim().optional(),
  referenceNumber: z.string().max(100).trim().optional(),
  currency:        z.string().length(3, 'Currency must be a 3-letter ISO 4217 code').toUpperCase().default('USD'),
  tags:            z.array(z.string().max(50).trim()).max(10).default([]),
  categoryId:      z.string().uuid('Invalid category ID').optional(),
});

export const updateRecordSchema = createRecordSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'At least one field is required' },
);

export const listRecordsSchema = z.object({
  page:           z.coerce.number().int().min(1).default(1),
  limit:          z.coerce.number().int().min(1).max(100).default(20),
  type:           z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  categoryId:     z.string().uuid().optional(),
  date_from:      z.string().regex(ISO_DATE).optional(),
  date_to:        z.string().regex(ISO_DATE).optional(),
  min_amount:     z.coerce.number().positive().optional(),
  max_amount:     z.coerce.number().positive().optional(),
  search:         z.string().max(200).trim().optional(),
  tags:           z.union([z.string(), z.array(z.string())]).optional()
    .transform((v) => (typeof v === 'string' ? [v] : v)),
  sort_by:        z.enum(['date', 'amount', 'created_at']).default('date'),
  sort_order:     z.enum(['asc', 'desc']).default('desc'),
  includeDeleted: z.coerce.boolean().default(false),
}).refine(
  (d) => {
    if (d.date_from && d.date_to) return d.date_from <= d.date_to;
    return true;
  },
  { message: 'date_from must be before or equal to date_to', path: ['date_from'] },
).refine(
  (d) => {
    if (d.min_amount && d.max_amount) return d.min_amount <= d.max_amount;
    return true;
  },
  { message: 'min_amount must be <= max_amount', path: ['min_amount'] },
);

export const exportQuerySchema = z.object({
  format:     z.enum(['json', 'csv']).default('json'),
  date_from:  z.string().regex(ISO_DATE).optional(),
  date_to:    z.string().regex(ISO_DATE).optional(),
  type:       z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  categoryId: z.string().uuid().optional(),
});

export type CreateRecordDto = z.infer<typeof createRecordSchema>;
export type UpdateRecordDto = z.infer<typeof updateRecordSchema>;
export type ListRecordsQuery = z.infer<typeof listRecordsSchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
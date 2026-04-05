import { z } from 'zod';

export const createUserSchema = z.object({
  email:    z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain digit')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  fullName: z.string().min(2).max(120).trim(),
  role:     z.enum(['VIEWER', 'ANALYST', 'ADMIN']).default('VIEWER'),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).max(120).trim().optional(),
  email:    z.string().email().max(255).transform((v) => v.toLowerCase().trim()).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

export const updateRoleSchema = z.object({
  role: z.enum(['VIEWER', 'ANALYST', 'ADMIN']),
});

export const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
});

export const listUsersSchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  role:   z.enum(['VIEWER', 'ANALYST', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  search: z.string().max(100).trim().optional(),
});

export type CreateUserDto  = z.infer<typeof createUserSchema>;
export type UpdateUserDto  = z.infer<typeof updateUserSchema>;
export type UpdateRoleDto  = z.infer<typeof updateRoleSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
export type ListUsersQuery = z.infer<typeof listUsersSchema>;
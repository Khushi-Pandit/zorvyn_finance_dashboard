import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerSchema = z.object({
  email:    z.string().email('Invalid email address').max(255).transform((v) => v.toLowerCase().trim()),
  password: passwordSchema,
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(120).trim(),
  role:     z.enum(['VIEWER', 'ANALYST', 'ADMIN']).optional(),
});

export const loginSchema = z.object({
  email:    z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword:     passwordSchema,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export type RegisterDto       = z.infer<typeof registerSchema>;
export type LoginDto          = z.infer<typeof loginSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
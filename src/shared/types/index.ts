import { Role, UserStatus, RecordType, CategoryType, AuditAction } from '@prisma/client';
import { Request } from 'express';

// Re-export Prisma enums for convenience
export { Role, UserStatus, RecordType, CategoryType, AuditAction };

// ─── AUTH TYPES ───────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;     // userId
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────

export interface PaginationQuery {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ─── API RESPONSE ─────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Array<{ field: string; message: string }>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── RECORD FILTER ────────────────────────────────────────────────────────────

export interface RecordFilter {
  type?: RecordType;
  categoryId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  tags?: string[];
  includeDeleted?: boolean;
  sortBy?: 'date' | 'amount' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

// ─── USER FILTER ──────────────────────────────────────────────────────────────

export interface UserFilter {
  role?: Role;
  status?: UserStatus;
  search?: string;
}

// ─── AUDIT CONTEXT ────────────────────────────────────────────────────────────

export interface AuditContext {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}
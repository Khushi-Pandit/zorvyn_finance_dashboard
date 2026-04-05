import { Response } from 'express';
import { config } from '../../config';
import crypto from 'crypto';
import { PaginatedResult, PaginationQuery } from '../types';

// ─── RESPONSE BUILDERS ────────────────────────────────────────────────────────

export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  meta?: Record<string, unknown>,
): void {
  res.status(status).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function sendPaginated<T>(
  res: Response,
  result: PaginatedResult<T>,
): void {
  res.status(200).json({
    success: true,
    data: result.data,
    meta: result.meta,
  });
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────

export function parsePagination(query: Record<string, unknown>): PaginationQuery {
  const page  = Math.max(1, parseInt(String(query.page  || 1), 10));
  const limit = Math.min(
    config.pagination.maxLimit,
    Math.max(1, parseInt(String(query.limit || config.pagination.defaultLimit), 10)),
  );
  return { page, limit };
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  { page, limit }: PaginationQuery,
): PaginatedResult<T> {
  const totalPages  = Math.ceil(total / limit);
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

export function getPrismaSkip({ page, limit }: PaginationQuery): number {
  return (page - 1) * limit;
}

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────

export function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? undefined : d;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function monthsBefore(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── SANITIZATION ─────────────────────────────────────────────────────────────

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((k) => delete result[k]);
  return result;
}

// ─── CRYPTO ───────────────────────────────────────────────────────────────────

export function generateToken(bytes = 64): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
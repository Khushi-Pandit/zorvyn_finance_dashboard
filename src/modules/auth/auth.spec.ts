import '../../tests/setup';

// ─── Mock Prisma before any imports ──────────────────────────────────────────
const mockFindFirst    = jest.fn();
const mockCreate       = jest.fn();
const mockUpdate       = jest.fn();
const mockUpdateMany   = jest.fn();
const mockTransaction  = jest.fn();
const mockFindUnique   = jest.fn();

jest.mock('../../config/database', () => ({
  prisma: {
    user: {
      findFirst:  (...a: any[]) => mockFindFirst(...a),
      create:     (...a: any[]) => mockCreate(...a),
      update:     (...a: any[]) => mockUpdate(...a),
      updateMany: (...a: any[]) => mockUpdateMany(...a),
    },
    refreshToken: {
      create:     (...a: any[]) => mockCreate(...a),
      findUnique: (...a: any[]) => mockFindUnique(...a),
      update:     (...a: any[]) => mockUpdate(...a),
      updateMany: (...a: any[]) => mockUpdateMany(...a),
    },
    $transaction: (...a: any[]) => mockTransaction(...a),
  },
  connectDatabase:    jest.fn(),
  disconnectDatabase: jest.fn(),
}));

jest.mock('../../audit', () => ({ writeAudit: jest.fn() }));
jest.mock('../../cache',  () => ({
  cache: { get: jest.fn(), set: jest.fn(), del: jest.fn(), delPattern: jest.fn() },
  getRedisClient: jest.fn(() => null),
}));

import { authService } from './auth.service';
import { ConflictError, UnauthorizedError, ForbiddenError, BadRequestError } from '../../shared/errors';

const MOCK_CTX = { ipAddress: '127.0.0.1', userAgent: 'jest' };

const ACTIVE_USER = {
  id:           'user-uuid-1',
  email:        'test@example.com',
  passwordHash: '$2a$04$testhashedpassword1234567890123456789012345678901',
  fullName:     'Test User',
  role:         'VIEWER',
  status:       'ACTIVE',
  lastLoginAt:  null,
  createdAt:    new Date(),
  updatedAt:    new Date(),
  deletedAt:    null,
};

// ─── register ─────────────────────────────────────────────────────────────────

describe('authService.register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws ConflictError if email already exists', async () => {
    mockFindFirst.mockResolvedValue(ACTIVE_USER);

    await expect(
      authService.register(
        { email: 'test@example.com', password: 'Pass@1234', fullName: 'Test' },
        MOCK_CTX,
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('creates a user and returns safe fields', async () => {
    mockFindFirst.mockResolvedValue(null);
    const safeUser = { ...ACTIVE_USER };
    delete (safeUser as any).passwordHash;
    mockCreate.mockResolvedValue(safeUser);

    const result = await authService.register(
      { email: 'new@example.com', password: 'NewPass@1', fullName: 'New User' },
      MOCK_CTX,
    );

    expect(result.email).toBe(ACTIVE_USER.email);
    expect(result).not.toHaveProperty('passwordHash');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe('authService.login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws UnauthorizedError if user not found', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'no@one.com', password: 'anything' }, MOCK_CTX),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('throws ForbiddenError if account is INACTIVE', async () => {
    mockFindFirst.mockResolvedValue({ ...ACTIVE_USER, status: 'INACTIVE' });

    await expect(
      authService.login({ email: 'test@example.com', password: 'Pass@1234' }, MOCK_CTX),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws UnauthorizedError on wrong password', async () => {
    // bcrypt.compare will return false for any non-matching hash
    mockFindFirst.mockResolvedValue(ACTIVE_USER);
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});

    await expect(
      authService.login({ email: 'test@example.com', password: 'WrongPass@1' }, MOCK_CTX),
    ).rejects.toThrow(UnauthorizedError);
  });
});

// ─── changePassword ───────────────────────────────────────────────────────────

describe('authService.changePassword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws BadRequestError if new password equals current', async () => {
    mockFindFirst.mockResolvedValue(ACTIVE_USER);

    // We can't easily mock bcrypt.compare without jest.mock('bcryptjs')
    // so we test the equal-passwords guard conceptually here
    // by using the same string — the service will reject it even before bcrypt
    // if we also mock compare to return true
    const bcrypt = require('bcryptjs');
    const spy    = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    await expect(
      authService.changePassword(
        'user-uuid-1',
        { currentPassword: 'Same@Pass1', newPassword: 'Same@Pass1' },
        MOCK_CTX,
      ),
    ).rejects.toThrow(BadRequestError);

    spy.mockRestore();
  });
});
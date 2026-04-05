import '../../tests/setup';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockFindMany   = jest.fn();
const mockFindById   = jest.fn();
const mockFindByEmail = jest.fn();
const mockCreate     = jest.fn();
const mockUpdate     = jest.fn();
const mockUpdateRole = jest.fn();
const mockUpdateStatus = jest.fn();
const mockSoftDelete = jest.fn();
const mockCountRecords = jest.fn();

jest.mock('./users.repository', () => ({
  usersRepository: {
    findMany:      (...a: any[]) => mockFindMany(...a),
    findById:      (...a: any[]) => mockFindById(...a),
    findByEmail:   (...a: any[]) => mockFindByEmail(...a),
    create:        (...a: any[]) => mockCreate(...a),
    update:        (...a: any[]) => mockUpdate(...a),
    updateRole:    (...a: any[]) => mockUpdateRole(...a),
    updateStatus:  (...a: any[]) => mockUpdateStatus(...a),
    softDelete:    (...a: any[]) => mockSoftDelete(...a),
    countRecords:  (...a: any[]) => mockCountRecords(...a),
  },
}));

jest.mock('../../audit',  () => ({ writeAudit: jest.fn() }));
jest.mock('../../cache',  () => ({
  cache: { get: jest.fn(), set: jest.fn(), del: jest.fn(), delPattern: jest.fn() },
}));
jest.mock('../../config/database', () => ({ prisma: {} }));

import { usersService } from './users.service';
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from '../../shared/errors';

const CTX = { actorId: 'admin-id', ipAddress: '127.0.0.1', userAgent: 'jest' };

const MOCK_USER = {
  id: 'user-id-1', email: 'user@test.com', fullName: 'Test User',
  role: 'VIEWER', status: 'ACTIVE', lastLoginAt: null,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('usersService.getById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws NotFoundError when user does not exist', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(usersService.getById('nonexistent')).rejects.toThrow(NotFoundError);
  });

  it('returns user when found', async () => {
    mockFindById.mockResolvedValue(MOCK_USER);
    const result = await usersService.getById('user-id-1');
    expect(result.email).toBe(MOCK_USER.email);
  });
});

describe('usersService.create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws ConflictError if email already taken', async () => {
    mockFindByEmail.mockResolvedValue(MOCK_USER);
    await expect(
      usersService.create(
        { email: 'user@test.com', password: 'Pass@1234', fullName: 'Dup', role: 'VIEWER' },
        CTX,
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('creates user when email is unique', async () => {
    mockFindByEmail.mockResolvedValue(null);
    mockCreate.mockResolvedValue(MOCK_USER);

    const result = await usersService.create(
      { email: 'new@test.com', password: 'Pass@1234', fullName: 'New', role: 'VIEWER' },
      CTX,
    );
    expect(result.email).toBe(MOCK_USER.email);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

describe('usersService.updateRole', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws BadRequestError if admin tries to change own role', async () => {
    mockFindById.mockResolvedValue(MOCK_USER);
    await expect(
      usersService.updateRole('admin-id', { role: 'VIEWER' }, { ...CTX, actorId: 'admin-id' }),
    ).rejects.toThrow(BadRequestError);
  });

  it('updates role when target is a different user', async () => {
    mockFindById.mockResolvedValue(MOCK_USER);
    mockUpdateRole.mockResolvedValue({ ...MOCK_USER, role: 'ANALYST' });

    const result = await usersService.updateRole('user-id-1', { role: 'ANALYST' }, CTX);
    expect(result.role).toBe('ANALYST');
  });
});

describe('usersService.softDelete', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws ForbiddenError if user tries to delete themselves', async () => {
    mockFindById.mockResolvedValue(MOCK_USER);
    await expect(
      usersService.softDelete('user-id-1', { ...CTX, actorId: 'user-id-1' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('soft-deletes another user', async () => {
    mockFindById.mockResolvedValue(MOCK_USER);
    mockCountRecords.mockResolvedValue(5);
    mockSoftDelete.mockResolvedValue({ ...MOCK_USER, deletedAt: new Date() });

    await usersService.softDelete('user-id-1', CTX);
    expect(mockSoftDelete).toHaveBeenCalledWith('user-id-1');
  });
});
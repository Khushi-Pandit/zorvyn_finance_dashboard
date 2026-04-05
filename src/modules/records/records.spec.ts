import '../../tests/setup';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockFindMany  = jest.fn();
const mockFindById  = jest.fn();
const mockCreate    = jest.fn();
const mockUpdate    = jest.fn();
const mockSoftDel   = jest.fn();
const mockRestore   = jest.fn();
const mockForExport = jest.fn();

jest.mock('./records.repository', () => ({
  recordsRepository: {
    findMany:      (...a: any[]) => mockFindMany(...a),
    findById:      (...a: any[]) => mockFindById(...a),
    create:        (...a: any[]) => mockCreate(...a),
    update:        (...a: any[]) => mockUpdate(...a),
    softDelete:    (...a: any[]) => mockSoftDel(...a),
    restore:       (...a: any[]) => mockRestore(...a),
    findForExport: (...a: any[]) => mockForExport(...a),
  },
}));

jest.mock('../../audit', () => ({ writeAudit: jest.fn() }));
jest.mock('../../cache', () => ({
  cache: { get: jest.fn(), set: jest.fn(), del: jest.fn(), delPattern: jest.fn(() => Promise.resolve()) },
}));
jest.mock('../../config/database', () => ({ prisma: {} }));

import { recordsService } from './records.service';
import { NotFoundError, BadRequestError } from '../../shared/errors';

const CTX     = { actorId: 'admin-id', ipAddress: '127.0.0.1', userAgent: 'jest' };
const RECORD  = {
  id: 'rec-1', amount: 1500, type: 'INCOME', date: new Date('2026-01-15'),
  description: 'Salary', referenceNumber: null, currency: 'USD', tags: [],
  categoryId: null, createdById: 'admin-id', lastModifiedById: 'admin-id',
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  category: null, createdBy: { id: 'admin-id', email: 'a@b.com', fullName: 'Admin' },
  lastModifiedBy: { id: 'admin-id', email: 'a@b.com', fullName: 'Admin' },
};

describe('recordsService.getById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws NotFoundError when record does not exist', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(recordsService.getById('nonexistent')).rejects.toThrow(NotFoundError);
  });

  it('returns record when found', async () => {
    mockFindById.mockResolvedValue(RECORD);
    const result = await recordsService.getById('rec-1');
    expect(result.id).toBe('rec-1');
  });
});

describe('recordsService.create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a record and returns it', async () => {
    mockFindMany.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 1, totalPages: 0, hasNextPage: false, hasPrevPage: false } });
    mockCreate.mockResolvedValue(RECORD);

    const result = await recordsService.create(
      { amount: 1500, type: 'INCOME', date: new Date('2026-01-15'), currency: 'USD', tags: [] },
      CTX,
    );
    expect(result.amount).toBe(1500);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

describe('recordsService.update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws NotFoundError when record missing', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(recordsService.update('bad-id', { amount: 100 }, CTX)).rejects.toThrow(NotFoundError);
  });

  it('throws BadRequestError when updating a soft-deleted record', async () => {
    mockFindById.mockResolvedValue({ ...RECORD, deletedAt: new Date() });
    await expect(recordsService.update('rec-1', { amount: 100 }, CTX)).rejects.toThrow(BadRequestError);
  });

  it('updates and returns modified record', async () => {
    mockFindById.mockResolvedValue(RECORD);
    mockUpdate.mockResolvedValue({ ...RECORD, amount: 2000, description: 'Updated' });

    const result = await recordsService.update('rec-1', { amount: 2000 }, CTX);
    expect(result.amount).toBe(2000);
  });
});

describe('recordsService.softDelete', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws NotFoundError when record missing', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(recordsService.softDelete('bad-id', CTX)).rejects.toThrow(NotFoundError);
  });

  it('throws BadRequestError when already deleted', async () => {
    mockFindById.mockResolvedValue({ ...RECORD, deletedAt: new Date() });
    await expect(recordsService.softDelete('rec-1', CTX)).rejects.toThrow(BadRequestError);
  });

  it('soft-deletes an active record', async () => {
    mockFindById.mockResolvedValue(RECORD);
    mockSoftDel.mockResolvedValue({ ...RECORD, deletedAt: new Date() });

    await recordsService.softDelete('rec-1', CTX);
    expect(mockSoftDel).toHaveBeenCalledWith('rec-1');
  });
});

describe('recordsService.restore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws BadRequestError when record is not deleted', async () => {
    mockFindById.mockResolvedValue(RECORD); // deletedAt is null
    await expect(recordsService.restore('rec-1', CTX)).rejects.toThrow(BadRequestError);
  });

  it('restores a soft-deleted record', async () => {
    mockFindById.mockResolvedValue({ ...RECORD, deletedAt: new Date() });
    mockRestore.mockResolvedValue(RECORD);

    const result = await recordsService.restore('rec-1', CTX);
    expect(result.id).toBe('rec-1');
  });
});

describe('recordsService.export', () => {
  beforeEach(() => jest.clearAllMocks());

  it('exports JSON format', async () => {
    mockForExport.mockResolvedValue([RECORD]);
    const result = await recordsService.export({ format: 'json', currency: 'USD' });
    expect(result.format).toBe('json');
    expect(result.count).toBe(1);
  });

  it('exports CSV format with header row', async () => {
    mockForExport.mockResolvedValue([RECORD]);
    const result = await recordsService.export({ format: 'csv', currency: 'USD' });
    expect(result.format).toBe('csv');
    expect(typeof result.content).toBe('string');
    expect((result.content as string).startsWith('id,date,type')).toBe(true);
  });
});
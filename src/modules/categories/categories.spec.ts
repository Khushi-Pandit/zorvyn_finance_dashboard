import '../../tests/setup';

const mockFindAll    = jest.fn();
const mockFindById   = jest.fn();
const mockFindByName = jest.fn();
const mockCreate     = jest.fn();
const mockUpdate     = jest.fn();
const mockDelete     = jest.fn();
const mockCountRecs  = jest.fn();

jest.mock('./categories.repository', () => ({
  categoriesRepository: {
    findAll:      (...a: any[]) => mockFindAll(...a),
    findById:     (...a: any[]) => mockFindById(...a),
    findByName:   (...a: any[]) => mockFindByName(...a),
    create:       (...a: any[]) => mockCreate(...a),
    update:       (...a: any[]) => mockUpdate(...a),
    delete:       (...a: any[]) => mockDelete(...a),
    countRecords: (...a: any[]) => mockCountRecs(...a),
  },
}));

jest.mock('../../audit', () => ({ writeAudit: jest.fn() }));
jest.mock('../../cache', () => ({
  cache: { get: jest.fn(() => Promise.resolve(null)), set: jest.fn(), del: jest.fn(), delPattern: jest.fn() },
  CacheKeys: { categoriesList: () => 'categories:list' },
}));
jest.mock('../../config/database', () => ({ prisma: {} }));

import { categoriesService } from './categories.service';
import { NotFoundError, ConflictError, BadRequestError } from '../../shared/errors';

const CTX     = { actorId: 'admin-id' };
const MOCK_CAT = { id: 'cat-1', name: 'Salary', type: 'INCOME', color: '#16A34A', icon: 'briefcase', isSystem: false, createdAt: new Date(), updatedAt: new Date() };

describe('categoriesService.create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws ConflictError when name already exists', async () => {
    mockFindByName.mockResolvedValue(MOCK_CAT);
    await expect(categoriesService.create({ name: 'Salary', type: 'INCOME' }, CTX as any)).rejects.toThrow(ConflictError);
  });

  it('creates category when name is unique', async () => {
    mockFindByName.mockResolvedValue(null);
    mockCreate.mockResolvedValue(MOCK_CAT);
    const result = await categoriesService.create({ name: 'New Cat', type: 'EXPENSE' }, CTX as any);
    expect(result.name).toBe('Salary');
  });
});

describe('categoriesService.delete', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws NotFoundError when category missing', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(categoriesService.delete('bad-id', CTX as any)).rejects.toThrow(NotFoundError);
  });

  it('throws BadRequestError for system categories', async () => {
    mockFindById.mockResolvedValue({ ...MOCK_CAT, isSystem: true });
    await expect(categoriesService.delete('cat-1', CTX as any)).rejects.toThrow(BadRequestError);
  });

  it('throws BadRequestError when category has linked records', async () => {
    mockFindById.mockResolvedValue(MOCK_CAT);
    mockCountRecs.mockResolvedValue(5);
    await expect(categoriesService.delete('cat-1', CTX as any)).rejects.toThrow(BadRequestError);
  });

  it('deletes category when no linked records', async () => {
    mockFindById.mockResolvedValue(MOCK_CAT);
    mockCountRecs.mockResolvedValue(0);
    mockDelete.mockResolvedValue(MOCK_CAT);
    await categoriesService.delete('cat-1', CTX as any);
    expect(mockDelete).toHaveBeenCalledWith('cat-1');
  });
});
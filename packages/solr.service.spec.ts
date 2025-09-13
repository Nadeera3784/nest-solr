import { Test } from '@nestjs/testing';
import { SolrService } from './solr.service';
import { SOLR_CLIENT } from './solr.constants';

describe('SolrService', () => {
  let service: SolrService;
  const mockClient = {
    search: jest.fn(async () => ({
      response: { numFound: 1, docs: [{ id: '1' }] },
    })),
    add: jest.fn(async () => ({ status: 0 })),
    commit: jest.fn(async () => ({ status: 0 })),
    optimize: jest.fn(async () => ({ status: 0 })),
    deleteByID: jest.fn(async () => ({ status: 0 })),
    deleteByQuery: jest.fn(async () => ({ status: 0 })),
    defineSchema: jest.fn(async (payload) => ({ ok: true, payload })),
  } as any;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SolrService, { provide: SOLR_CLIENT, useValue: mockClient }],
    }).compile();

    service = moduleRef.get(SolrService);
    jest.clearAllMocks();
  });

  it('creates query builder', () => {
    const qb = service.createQuery();
    const params = qb.eq('id', '1').toParams();
    expect(params.q).toBe('id:1');
  });

  it('performs search with params', async () => {
    const qb = service.createQuery().q('*:*').rows(5);
    const res = await service.search(qb);
    expect(mockClient.search).toHaveBeenCalledWith(qb.toParams());
    expect(res.response.numFound).toBe(1);
  });

  it('add/commit/delete operations call client', async () => {
    await service.add({ id: '1' });
    await service.commit();
    await service.deleteByID('1');
    await service.deleteByQuery('id:1');
    await service.optimize();
    expect(mockClient.add).toHaveBeenCalled();
    expect(mockClient.commit).toHaveBeenCalled();
    expect(mockClient.deleteByID).toHaveBeenCalledWith('1');
    expect(mockClient.deleteByQuery).toHaveBeenCalledWith('id:1');
    expect(mockClient.optimize).toHaveBeenCalled();
  });

  it('defineSchema delegates to client with transformed payload', async () => {
    const res = await service.defineSchema({
      fieldTypes: [{ name: 'text_en', class: 'solr.TextField' }],
      fields: [{ name: 'title', type: 'text_en', stored: true, indexed: true }],
      copyFields: [{ source: 'title', dest: 'text' }],
      uniqueKey: 'id',
    });
    expect(mockClient.defineSchema).toHaveBeenCalledWith({
      fieldTypes: [{ name: 'text_en', class: 'solr.TextField' }],
      fields: [{ name: 'title', type: 'text_en', stored: true, indexed: true }],
      copyFields: [{ source: 'title', dest: 'text' }],
      uniqueKey: 'id',
    });
    expect(res.ok).toBe(true);
  });

  describe('searchWithCursor', () => {
    it('applies default sort and cursor when missing', async () => {
      const qb = service.createQuery().eq('type', 'book').rows(2);
      const res = await service.searchWithCursor(qb);
      expect(mockClient.search).toHaveBeenCalledTimes(1);
      const arg = (mockClient.search as jest.Mock).mock.calls[0][0];
      expect(arg.cursorMark).toBe('*');
      expect(arg.sort).toBe('id asc');
      expect(res.nextCursorMark).toBe('*');
    });

    it('appends uniqueKey to existing sort when missing', async () => {
      const qb = service.createQuery().q('*:*').sort('price', 'asc').rows(10);
      await service.searchWithCursor(qb, '*');
      const arg = (mockClient.search as jest.Mock).mock.calls[0][0];
      expect(arg.sort).toBe('price asc, id asc');
    });

    it('respects builder-provided cursor when arg omitted', async () => {
      const qb = service
        .createQuery()
        .q('*:*')
        .sort('price', 'desc')
        .rows(5)
        .cursor('abc');
      const res = await service.searchWithCursor(qb);
      const arg = (mockClient.search as jest.Mock).mock.calls[0][0];
      expect(arg.cursorMark).toBe('abc');
      expect(arg.sort).toBe('price desc, id asc');
      expect(res.nextCursorMark).toBe('abc');
    });

    it('propagates client-provided nextCursorMark', async () => {
      (mockClient.search as jest.Mock).mockResolvedValueOnce({
        response: { numFound: 0, docs: [] },
        nextCursorMark: 'zzz',
      });
      const qb = service.createQuery().q('*:*').rows(1);
      const res = await service.searchWithCursor(qb, 'foo');
      expect(res.nextCursorMark).toBe('zzz');
    });

    it('accepts plain params object', async () => {
      await service.searchWithCursor({ q: '*:*', rows: 3 } as any);
      const arg = (mockClient.search as jest.Mock).mock.calls[0][0];
      expect(arg.sort).toBe('id asc');
      expect(arg.cursorMark).toBe('*');
    });
  });
});

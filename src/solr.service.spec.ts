import { Test } from '@nestjs/testing';
import { SolrService } from './solr.service';
import { SOLR_CLIENT } from './solr.constants';

describe('SolrService', () => {
  let service: SolrService;
  const mockClient = {
    search: jest.fn(async () => ({ response: { numFound: 1, docs: [{ id: '1' }] } })),
    add: jest.fn(async () => ({ status: 0 })),
    commit: jest.fn(async () => ({ status: 0 })),
    optimize: jest.fn(async () => ({ status: 0 })),
    deleteByID: jest.fn(async () => ({ status: 0 })),
    deleteByQuery: jest.fn(async () => ({ status: 0 })),
  } as any;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SolrService,
        { provide: SOLR_CLIENT, useValue: mockClient },
      ],
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
});



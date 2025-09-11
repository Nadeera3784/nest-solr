import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as http from 'http';
import { SolrModule } from '../src/solr.module';
import { SolrService } from '../src/solr.service';

describe('SolrModule (e2e)', () => {
  let app: INestApplication;
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url?.startsWith('/solr/test/select')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ response: { numFound: 1, docs: [{ id: '1' }] } }),
        );
        return;
      }
      if (req.url?.startsWith('/solr/test/update')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 0 }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (typeof address === 'object' && address && 'port' in address)
      port = address.port as number;

    const moduleRef = await Test.createTestingModule({
      imports: [
        SolrModule.forRoot({
          host: '127.0.0.1',
          port,
          path: '/solr',
          core: 'test',
          secure: false,
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('searches using the service and query builder', async () => {
    const solr = app.get(SolrService);
    const qb = solr.createQuery().q('*:*').rows(1);
    const res = await solr.search(qb);
    expect(res.response.numFound).toBe(1);
  });
});

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SolrModule } from '../src/solr.module';
import { SolrService } from '../src/solr.service';
import * as http from 'http';

async function waitForSolr(host = '127.0.0.1', port = 8983, core = 'mycore', timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ok = await new Promise<boolean>((resolve) => {
        const req = http.request({ host, port, path: `/solr/${core}/admin/ping?wt=json`, method: 'GET' }, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (d) => chunks.push(d));
          res.on('end', () => {
            try {
              const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              resolve(json.status === 'OK' || json.responseHeader?.status === 0);
            } catch {
              resolve(false);
            }
          });
        });
        req.on('error', () => resolve(false));
        req.end();
      });
      if (ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Solr did not become ready in time');
}

describe('Solr real E2E (with Docker)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await waitForSolr('127.0.0.1', 8983, 'mycore', 120000);
    const moduleRef = await Test.createTestingModule({
      imports: [
        SolrModule.forRoot({ host: '127.0.0.1', port: 8983, path: '/solr', core: 'mycore', secure: false }),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }, 180000);

  afterAll(async () => {
    await app.close();
  });

  it('can add and search a document', async () => {
    const solr = app.get(SolrService);
    await solr.add({ id: 'doc-1', title: 'Hello Solr' }, { commitWithin: 1000, overwrite: true });
    await solr.commit();
    const qb = solr.createQuery().eq('id', 'doc-1').rows(1);
    const res = await solr.search(qb);
    expect(res.response.numFound).toBeGreaterThanOrEqual(1);
  });
});



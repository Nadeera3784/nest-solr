import * as http from 'http';
import { SolrHttpClient } from './solr-http.client';

describe('SolrHttpClient', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url?.startsWith('/solr/core/select')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ response: { numFound: 1, docs: [{ id: 'x' }] } }));
        return;
      }
      if (req.method === 'POST' && req.url?.startsWith('/solr/core/update')) {
        let body = '';
        req.on('data', (d) => (body += d));
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, received: body?.length > 0 }));
        });
        return;
      }
      if (req.method === 'POST' && req.url?.startsWith('/solr/core/schema')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    if (typeof addr === 'object' && addr) port = addr.port as number;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('performs search with params', async () => {
    const client = new SolrHttpClient({ host: '127.0.0.1', port, path: '/solr', core: 'core' });
    const res = await client.search({ q: '*:*', rows: 1 });
    expect(res.response.numFound).toBe(1);
  });

  it('sends update operations (add/commit/delete)', async () => {
    const client = new SolrHttpClient({ host: '127.0.0.1', port, path: '/solr', core: 'core' });
    await expect(client.add({ id: 'a' }, { overwrite: true })).resolves.toBeDefined();
    await expect(client.commit()).resolves.toBeDefined();
    await expect(client.deleteByID('a')).resolves.toBeDefined();
    await expect(client.deleteByQuery('id:a')).resolves.toBeDefined();
    await expect(client.optimize()).resolves.toBeDefined();
  });
});



import * as http from 'http';
import { SolrHttpClient } from './solr-http.client';

describe('SolrHttpClient', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url?.startsWith('/solr/core/select')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ response: { numFound: 1, docs: [{ id: 'x' }] } }),
        );
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
        let body = '';
        req.on('data', (d) => (body += d));
        req.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(body || '[]');
          } catch {
            parsed = body;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(parsed));
        });
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
    const client = new SolrHttpClient({
      host: '127.0.0.1',
      port,
      path: '/solr',
      core: 'core',
    });
    const res = await client.search({ q: '*:*', rows: 1 });
    expect(res.response.numFound).toBe(1);
  });

  it('sends update operations (add/commit/delete)', async () => {
    const client = new SolrHttpClient({
      host: '127.0.0.1',
      port,
      path: '/solr',
      core: 'core',
    });
    await expect(
      client.add({ id: 'a' }, { overwrite: true }),
    ).resolves.toBeDefined();
    await expect(client.commit()).resolves.toBeDefined();
    await expect(client.deleteByID('a')).resolves.toBeDefined();
    await expect(client.deleteByQuery('id:a')).resolves.toBeDefined();
    await expect(client.optimize()).resolves.toBeDefined();
  });

  it('sends schema operations to /schema with correct commands', async () => {
    const client = new SolrHttpClient({
      host: '127.0.0.1',
      port,
      path: '/solr',
      core: 'core',
    });

    const payload = await client.defineSchema({
      fieldTypes: [{ name: 'text_en', class: 'solr.TextField' }],
      fields: [
        { name: 'id', type: 'string', stored: true, indexed: true, required: true },
        { name: 'title', type: 'text_en', stored: true, indexed: true },
      ],
      copyFields: [{ source: 'title', dest: ['text', 'all'] }],
      uniqueKey: 'id',
    });

    // server echoes the JSON body back to us
    expect(Array.isArray(payload)).toBe(true);
    // Expect 1 fieldType + 2 fields + 2 copyField entries + 1 uniqueKey = 6 commands
    expect(payload).toHaveLength(6);
    expect(payload[0]).toEqual({ 'add-field-type': { name: 'text_en', class: 'solr.TextField' } });
    expect(payload.some((c: any) => c['add-field']?.name === 'id')).toBe(true);
    expect(payload.some((c: any) => c['add-field']?.name === 'title')).toBe(true);
    const copyFields = payload.filter((c: any) => c['add-copy-field']);
    expect(copyFields).toHaveLength(2);
    const dests = copyFields.map((c: any) => c['add-copy-field'].dest).sort();
    expect(dests).toEqual(['all', 'text']);
    expect(payload[payload.length - 1]).toEqual({ 'set-unique-key': 'id' });
  });
});

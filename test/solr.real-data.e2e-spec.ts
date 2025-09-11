import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SolrModule } from '../src/solr.module';
import { SolrService } from '../src/solr.service';
import * as http from 'http';

describe('Solr real-data E2E', () => {
  let app: INestApplication;
  let solr: SolrService;

  const docs = [
    {
      id: 'b-1',
      type: 'book',
      title: 'Node in Action',
      price: 25,
      category: 'tech',
      author: 'Alice',
    },
    {
      id: 'b-2',
      type: 'book',
      title: 'Mastering NestJS',
      price: 35,
      category: 'tech',
      author: 'Bob',
    },
    {
      id: 'b-3',
      type: 'book',
      title: 'Cooking 101',
      price: 15,
      category: 'cooking',
      author: 'Carla',
    },
    {
      id: 'm-1',
      type: 'magazine',
      title: 'Tech Today',
      price: 10,
      category: 'tech',
      author: 'Dave',
    },
  ];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        SolrModule.forRoot({
          host: '127.0.0.1',
          port: 8983,
          path: '/solr',
          core: 'mycore',
          secure: false,
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    solr = app.get(SolrService);

    await addFields([
      { name: 'type', type: 'string', stored: true, indexed: true },
      { name: 'title', type: 'text_general', stored: true, indexed: true },
      { name: 'price', type: 'pfloat', stored: true, indexed: true },
      { name: 'category', type: 'string', stored: true, indexed: true },
      { name: 'author', type: 'string', stored: true, indexed: true },
    ]);

    await solr.deleteByQuery('id:b-* OR id:m-*');
    await solr.commit();

    await solr.add(docs, { overwrite: true, commitWithin: 1000 });
    await solr.commit();
  }, 60000);

  afterAll(async () => {
    await solr.deleteByQuery('id:b-* OR id:m-*');
    await solr.commit();
    await app.close();
  });

  it('queries by type and price range', async () => {
    const qb = solr
      .createQuery()
      .eq('type', 'book')
      .and()
      .between('price', 10, 30)
      .rows(10)
      .sort('price', 'asc');
    const res = await solr.search(qb);
    const foundIds = res.response.docs.map((d: any) => d.id).sort();
    expect(foundIds).toEqual(['b-1', 'b-3']);
  });

  it('facets on category', async () => {
    const qb = solr.createQuery().q('*:*').facet(['category']).rows(0);
    const res = await solr.search(qb);

    const list: any[] = res.facet_counts?.facet_fields?.category || [];
    const pairs: Record<string, number> = {};
    for (let i = 0; i < list.length; i += 2) pairs[list[i]] = list[i + 1];
    expect(pairs.tech).toBeGreaterThanOrEqual(1);
    expect(pairs.cooking).toBeGreaterThanOrEqual(1);
  });

  it('executes complex boolean query with filters and grouping', async () => {
    const qb = solr
      .createQuery()
      .group(true)
      .eq('type', 'book')
      .and()
      .group(true)
      .phrase('title', 'Mastering NestJS')
      .or()
      .startsWith('title', 'Node')
      .group(false)
      .group(false)
      .and()
      .in('category', ['tech', 'cooking'])
      .filter('price:[10 TO 40]')
      .fields(['id', 'title', 'price'])
      .sort('price', 'desc')
      .rows(5);

    const res = await solr.search(qb);
    const ids = res.response.docs.map((d: any) => d.id);
    expect(ids).toEqual(['b-2', 'b-1']);
  }, 20000);

  it('deletes by ID and verifies', async () => {
    await solr.deleteByQuery('id:m-1');
    await solr.commit();
    let numFound = -1;
    for (let i = 0; i < 10; i += 1) {
      const res = await solr.search(solr.createQuery().eq('id', 'm-1').rows(1));
      numFound = res.response.numFound;
      if (numFound === 0) break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(numFound).toBe(0);
  }, 20000);
});

async function addFields(
  fields: Array<{
    name: string;
    type: string;
    stored: boolean;
    indexed: boolean;
  }>,
): Promise<void> {
  for (const field of fields) {
    const body = JSON.stringify({ 'add-field': field });
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          method: 'POST',
          host: '127.0.0.1',
          port: 8983,
          path: '/solr/mycore/schema',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body).toString(),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (d) => chunks.push(d));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300)
              return resolve();

            try {
              const json = JSON.parse(text);
              const details = json.error?.details || [];
              const exists =
                Array.isArray(details) &&
                details.some((d: any) =>
                  (d.errorMessages || []).some((m: string) =>
                    /already exists/i.test(m),
                  ),
                );
              if (exists) return resolve();
            } catch {}
            reject(
              new Error(
                `Schema update failed: ${res.statusCode} ${res.statusMessage} - ${text}`,
              ),
            );
          });
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

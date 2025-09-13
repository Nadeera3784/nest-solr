<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

<h1 align="center">
  nest-solr
</h1>

<p align="center">
  A <a href="https://github.com/nestjs/nest">Nest</a> module for <a href="https://solr.apache.org/">Apache Solr</a>
</p>



### Installation

```bash
npm install nest-solr
```

### Quick start

Register the module synchronously:

```ts
import { Module } from '@nestjs/common';
import { SolrModule } from 'nest-solr';

@Module({
  imports: [
    SolrModule.forRoot({
      host: 'localhost',
      port: 8983,
      core: 'mycore',
      secure: false,
    }),
  ],
})
export class AppModule {}
```

Or asynchronously using a factory:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SolrModule } from 'nest-solr';

@Module({
  imports: [
    ConfigModule.forRoot(),
    SolrModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        host: config.get<string>('SOLR_HOST', 'localhost'),
        port: config.get<number>('SOLR_PORT', 8983),
        core: config.get<string>('SOLR_CORE', 'mycore'),
        secure: config.get<boolean>('SOLR_SECURE', false),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Usage

```ts
import { Injectable } from '@nestjs/common';
import { SolrService } from 'nest-solr';

@Injectable()
export class SearchService {
  constructor(private readonly solr: SolrService) {}

  async find() {
    const qb = this.solr.createQuery()
      .eq('type', 'book')
      .and()
      .between('price', 10, 100)
      .fields(['id', 'title', 'price'])
      .sort('price', 'asc')
      .rows(25);

    return this.solr.search(qb.toParams());
  }
}
```

### CRUD example

```ts
import { Injectable } from '@nestjs/common';
import { SolrService } from 'nest-solr';

interface Book {
  id: string;
  title: string;
  price: number;
  type: 'book';
}

@Injectable()
export class BooksService {
  constructor(private readonly solr: SolrService) {}

  // Create (single or bulk)
  async createBooks() {
    await this.solr.add<Book>(
      { id: 'b-1', title: 'Clean Code', price: 29.99, type: 'book' },
      { commitWithin: 500 },
    );

    await this.solr.add<Book>(
      [
        { id: 'b-2', title: 'Node Patterns', price: 39.5, type: 'book' },
        { id: 'b-3', title: 'Mastering NestJS', price: 49, type: 'book' },
      ],
      { commitWithin: 500 },
    );

    // Or force an immediate commit for reads right away
    await this.solr.commit();
  }

  // Read / Search
  async findCheapBooks() {
    const qb = this.solr
      .createQuery()
      .eq('type', 'book')
      .and()
      .lt('price', 40)
      .fields(['id', 'title', 'price'])
      .sort('price', 'asc')
      .rows(10);

    const result = await this.solr.search(qb);
    return result.response?.docs ?? [];
  }

  // Update (same as add with overwrite)
  async updatePrice(id: string, newPrice: number) {
    await this.solr.add({ id, price: newPrice }, { overwrite: true });
    await this.solr.commit();
  }

  // Delete
  async removeById(id: string) {
    await this.solr.deleteByID(id);
    await this.solr.commit();
  }

  async removeByQuery() {
    // Deletes all books cheaper than 10
    await this.solr.deleteByQuery('type:book AND price:{* TO 10}');
    await this.solr.commit();
  }
}
```

### Advanced: complex query

```ts
import { Injectable } from '@nestjs/common';
import { SolrService } from 'nest-solr';

@Injectable()
export class SearchService {
  constructor(private readonly solr: SolrService) {}

  async complexSearch() {
    const qb = this.solr
      .createQuery()
      // (type:book AND (title:"Mastering NestJS" OR title:Node*))
      .group(true)
        .eq('type', 'book')
        .and()
        .group(true)
          .phrase('title', 'Mastering NestJS')
          .or()
          .startsWith('title', 'Node')
        .group(false)
      .group(false)
      // AND category:(tech OR cooking)
      .and()
      .in('category', ['tech', 'cooking'])
      // Filter price range
      .filter('price:[10 TO 40]')
      // Only return selected fields
      .fields(['id', 'title', 'price'])
      // Sort and paginate
      .sort('price', 'desc')
      .start(0)
      .rows(10)
      // Enable facets (example)
      .facet(['category']);

    // Execute
    const result = await this.solr.search(qb);
    return {
      total: result.response?.numFound ?? 0,
      items: result.response?.docs ?? [],
      facets: result.facet_counts?.facet_fields ?? {},
    };
  }
}
```

### CursorMark pagination

```ts
import { Injectable } from '@nestjs/common';
import { SolrService } from 'nest-solr';

@Injectable()
export class CursorExampleService {
  constructor(private readonly solr: SolrService) {}

  // Fetch all books in pages of 50 using CursorMark
  async fetchAllBooks() {
    const qb = this.solr
      .createQuery()
      .eq('type', 'book')
      // CursorMark requires deterministic sort; service will append `id asc` if missing
      .sort('price', 'asc')
      .rows(50)
      .cursor('*'); // optional, you can also pass '*' to the service

    let cursor = '*';
    const all: any[] = [];
    while (true) {
      // You can either rely on qb.cursor('*') or pass the mark explicitly
      const res = await this.solr.searchWithCursor(qb, cursor);
      all.push(...(res.response?.docs ?? []));
      if (!res.nextCursorMark || res.nextCursorMark === cursor) break; // end reached
      cursor = res.nextCursorMark;
    }
    return all;
  }
}
```

### Define schema (Schema API)

```ts
// Define field types, fields, copy fields and unique key
await solrService.defineSchema({
  fieldTypes: [
    { name: 'text_en', class: 'solr.TextField', positionIncrementGap: '100' },
  ],
  fields: [
    { name: 'id', type: 'string', stored: true, indexed: true, required: true },
    { name: 'title', type: 'text_en', stored: true, indexed: true },
  ],
  // dest can be a string or string[]; multiple entries are expanded
  copyFields: [{ source: 'title', dest: ['text', 'all'] }],
  uniqueKey: 'id',
});
```

### SolrService API

- **getClient()**: returns the underlying HTTP client instance.
- **createQuery()**: creates a new `SolrQueryBuilder` instance.
- **add(docOrDocs, options?)**: adds a document or array of documents; supports `{ commitWithin, overwrite }`.
- **commit()**: commits pending changes (uses `waitSearcher=true`).
- **deleteByID(id)**: deletes by `id` field.
- **deleteByQuery(query)**: deletes documents matching a query string (e.g., `id:123`).
- **optimize(options?)**: optimizes the index; supports `{ softCommit, waitSearcher, maxSegments }`.
- **search(queryOrBuilder)**: executes a search; accepts a `SolrQueryBuilder` or params object from `builder.toParams()`.
- **defineSchema(options)**: defines schema via Solr Schema API; supports `{ fieldTypes, fields, copyFields, uniqueKey }`.




## License

 [MIT licensed](LICENSE).

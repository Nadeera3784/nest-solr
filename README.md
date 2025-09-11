<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>

  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## nest-solr

NestJS module for Apache Solr.

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

### SolrService API

- **getClient()**: returns the underlying HTTP client instance.
- **createQuery()**: creates a new `SolrQueryBuilder` instance.
- **add(docOrDocs, options?)**: adds a document or array of documents; supports `{ commitWithin, overwrite }`.
- **commit()**: commits pending changes (uses `waitSearcher=true`).
- **deleteByID(id)**: deletes by `id` field.
- **deleteByQuery(query)**: deletes documents matching a query string (e.g., `id:123`).
- **optimize(options?)**: optimizes the index; supports `{ softCommit, waitSearcher, maxSegments }`.
- **search(queryOrBuilder)**: executes a search; accepts a `SolrQueryBuilder` or params object from `builder.toParams()`.




## License

Nest is [MIT licensed](LICENSE).

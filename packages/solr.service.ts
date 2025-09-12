import { Inject, Injectable } from '@nestjs/common';
import { SOLR_CLIENT } from './solr.constants';
import { SolrQueryBuilder } from './solr.query-builder';
import type { SolrHttpClient, SolrSearchParams } from './solr-http.client';
import type {
  SolrCopyField,
  SolrDefineSchemaOptions,
  SolrFieldType,
  SolrSchemaField,
} from './interfaces/solr.interfaces';

@Injectable()
export class SolrService {
  constructor(@Inject(SOLR_CLIENT) private readonly client: SolrHttpClient) {}

  getClient(): SolrHttpClient {
    return this.client;
  }

  createQuery(): SolrQueryBuilder {
    return new SolrQueryBuilder();
  }

  async add<T extends Record<string, any>>(
    doc: T | T[],
    options?: { commitWithin?: number; overwrite?: boolean },
  ): Promise<any> {
    return this.client.add(doc as any, options as any);
  }

  async commit(): Promise<any> {
    return this.client.commit();
  }

  async deleteByID(id: string | number): Promise<any> {
    return this.client.deleteByID(id);
  }

  async deleteByQuery(query: string): Promise<any> {
    return this.client.deleteByQuery(query);
  }

  async optimize(options?: {
    softCommit?: boolean;
    waitSearcher?: boolean;
    maxSegments?: number;
  }): Promise<any> {
    return this.client.optimize(options as any);
  }

  async search(query: SolrSearchParams | SolrQueryBuilder): Promise<any> {
    const params = query instanceof SolrQueryBuilder ? query.toParams() : query;
    return this.client.search(params);
  }

  async defineSchema(options: SolrDefineSchemaOptions): Promise<any> {
    return this.client.defineSchema({
      fields: options.fields as Array<Record<string, any>> | undefined,
      fieldTypes: options.fieldTypes as Array<Record<string, any>> | undefined,
      copyFields: options.copyFields,
      uniqueKey: options.uniqueKey,
    });
  }
}

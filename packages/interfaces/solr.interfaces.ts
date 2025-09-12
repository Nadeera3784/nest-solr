import { ModuleMetadata, Type } from '@nestjs/common';

export interface SolrModuleOptions {
  host?: string;
  port?: string | number;
  core?: string;
  path?: string;
  secure?: boolean;
  basicAuth?: { username: string; password: string };
}

export interface SolrModuleOptionsFactory {
  createSolrModuleOptions(): Promise<SolrModuleOptions> | SolrModuleOptions;
}

export interface SolrModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<SolrModuleOptionsFactory>;
  useClass?: Type<SolrModuleOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<SolrModuleOptions> | SolrModuleOptions;
  inject?: any[];
}

export interface SolrSchemaField {
  name: string;
  type: string;
  stored?: boolean;
  indexed?: boolean;
  multiValued?: boolean;
  required?: boolean;
  docValues?: boolean;
  omitNorms?: boolean;
  [key: string]: any;
}

export interface SolrFieldType {
  name: string;
  class?: string;
  [key: string]: any;
}

export interface SolrCopyField {
  source: string;
  dest: string | string[];
  maxChars?: number;
}

export interface SolrDefineSchemaOptions {
  fields?: SolrSchemaField[];
  fieldTypes?: SolrFieldType[];
  copyFields?: SolrCopyField[];
  uniqueKey?: string;
}

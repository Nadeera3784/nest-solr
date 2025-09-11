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

export interface SolrModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<SolrModuleOptionsFactory>;
  useClass?: Type<SolrModuleOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<SolrModuleOptions> | SolrModuleOptions;
  inject?: any[];
}



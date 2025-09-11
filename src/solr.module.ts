import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { SOLR_CLIENT, SOLR_MODULE_OPTIONS } from './solr.constants';
import { SolrModuleAsyncOptions, SolrModuleOptions, SolrModuleOptionsFactory } from './interfaces/solr.interfaces';
import { SolrService } from './solr.service';
import { SolrHttpClient } from './solr-http.client';

@Global()
@Module({})
export class SolrModule {
  static forRoot(options: SolrModuleOptions = {}): DynamicModule {
    const optionsProvider: Provider = {
      provide: SOLR_MODULE_OPTIONS,
      useValue: options,
    };

    const clientProvider: Provider = {
      provide: SOLR_CLIENT,
      useFactory: () => new SolrHttpClient({
        host: options.host,
        port: options.port as any,
        core: options.core,
        path: options.path,
        secure: options.secure,
        basicAuth: options.basicAuth,
      }),
    };

    return {
      module: SolrModule,
      providers: [optionsProvider, clientProvider, SolrService],
      exports: [SolrService],
    };
  }

  static forRootAsync(options: SolrModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);
    const clientProvider: Provider = {
      provide: SOLR_CLIENT,
      useFactory: (opts: SolrModuleOptions) =>
        new SolrHttpClient({
          host: opts.host,
          port: opts.port as any,
          core: opts.core,
          path: opts.path,
          secure: opts.secure,
          basicAuth: opts.basicAuth,
        }),
      inject: [SOLR_MODULE_OPTIONS],
    };

    return {
      module: SolrModule,
      imports: options.imports || [],
      providers: [...asyncProviders, clientProvider, SolrService],
      exports: [SolrService],
    };
  }

  private static createAsyncProviders(options: SolrModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: SOLR_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ];
    }

    const useClass = options.useClass || options.useExisting;
    if (!useClass) {
      throw new Error('Invalid SolrModuleAsyncOptions: provide useFactory, useClass or useExisting');
    }

    const providers: Provider[] = [
      {
        provide: SOLR_MODULE_OPTIONS,
        useFactory: async (factory: SolrModuleOptionsFactory) => factory.createSolrModuleOptions(),
        inject: [useClass],
      },
    ];

    if (options.useClass) {
      providers.push({ provide: options.useClass, useClass: options.useClass });
    }

    return providers;
  }
}


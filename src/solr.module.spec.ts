import { Module, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SolrModule } from './solr.module';
import { SolrService } from './solr.service';
import { SolrModuleAsyncOptions, SolrModuleOptions, SolrModuleOptionsFactory } from './interfaces/solr.interfaces';

@Injectable()
class OptsFactory implements SolrModuleOptionsFactory {
  createSolrModuleOptions(): SolrModuleOptions {
    return { host: 'localhost', port: 0, core: 'core', path: '/solr' };
  }
}

@Module({ providers: [OptsFactory], exports: [OptsFactory] })
class OptsModule {}

describe('SolrModule', () => {
  it('registers via forRoot', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SolrModule.forRoot({ host: 'localhost', port: 8983, core: 'core', path: '/solr' })],
    }).compile();
    const solr = moduleRef.get(SolrService);
    expect(solr).toBeDefined();
  });

  it('registers via forRootAsync with useFactory', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        SolrModule.forRootAsync({
          useFactory: async (): Promise<SolrModuleOptions> => ({ host: 'localhost', port: 8983, core: 'core', path: '/solr' }),
        } as SolrModuleAsyncOptions),
      ],
    }).compile();
    expect(moduleRef.get(SolrService)).toBeDefined();
  });

  it('registers via forRootAsync with useClass', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SolrModule.forRootAsync({ useClass: OptsFactory, imports: [OptsModule] } as SolrModuleAsyncOptions)],
    }).compile();
    expect(moduleRef.get(SolrService)).toBeDefined();
  });
});



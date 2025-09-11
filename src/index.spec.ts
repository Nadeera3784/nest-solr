describe('index barrel exports', () => {
  it('should export module, service, builder, constants and interfaces', async () => {
    const api = await import('./index');
    expect(api.SolrModule).toBeDefined();
    expect(api.SolrService).toBeDefined();
    expect(api.SolrQueryBuilder).toBeDefined();
    expect(api.SOLR_CLIENT).toBeDefined();
    expect(api.SOLR_MODULE_OPTIONS).toBeDefined();
  });
});



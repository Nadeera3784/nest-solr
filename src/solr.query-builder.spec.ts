import { SolrQueryBuilder } from './solr.query-builder';

describe('SolrQueryBuilder', () => {
  it('builds simple eq query', () => {
    const qb = new SolrQueryBuilder().eq('type', 'book');
    const params = qb.toParams();
    expect(params.q).toBe('type:book');
  });

  it('combines AND and range', () => {
    const qb = new SolrQueryBuilder()
      .eq('type', 'book')
      .and()
      .between('price', 10, 20)
      .fields(['id', 'title'])
      .sort('price', 'asc')
      .rows(10)
      .start(5);
    const params = qb.toParams();
    expect(params.q).toBe('type:book AND price:[10 TO 20]');
    expect(params.fl).toBe('id,title');
    expect(params.sort).toBe('price asc');
    expect(params.rows).toBe(10);
    expect(params.start).toBe(5);
  });

  it('adds filter queries and facets', () => {
    const qb = new SolrQueryBuilder()
      .q('*:*')
      .matchFilter('category', 'tech')
      .facet(['category', 'author']);
    const params = qb.toParams();
    expect(params.q).toBe('*:*');
    expect(params['fq']).toEqual(['category:tech']);
    expect(params['facet']).toBe(true);
    expect(params['facet.field']).toEqual(['category', 'author']);
  });

  it('supports inequality and wildcard and grouping', () => {
    const qb = new SolrQueryBuilder()
      .group(true)
        .ne('type', 'magazine')
        .and()
        .startsWith('title', 'Cook')
      .group(false);
    const params = qb.toParams();
    expect(params.q).toBe('( -type:magazine AND title:Cook* )');
  });
});



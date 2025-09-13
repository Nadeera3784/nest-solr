type SortDirection = 'asc' | 'desc';

export class SolrQueryBuilder {
  private readonly qParts: string[] = [];
  private readonly filterQueries: string[] = [];
  private paramsMap: Record<string, string | number | string[] | boolean> = {};

  // Core
  q(query: string): this {
    this.qParts.push(query);
    return this;
  }

  // Expression helpers
  eq(field: string, value: string | number | boolean): this {
    return this.q(`${field}:${this.escapeValue(value)}`);
  }

  ne(field: string, value: string | number | boolean): this {
    return this.q(`-${field}:${this.escapeValue(value)}`);
  }

  gt(field: string, value: string | number): this {
    return this.q(`${field}:{${this.escapeValue(value)} TO *}`);
  }

  gte(field: string, value: string | number): this {
    return this.q(`${field}:[${this.escapeValue(value)} TO *]`);
  }

  lt(field: string, value: string | number): this {
    return this.q(`${field}:{* TO ${this.escapeValue(value)}}`);
  }

  lte(field: string, value: string | number): this {
    return this.q(`${field}:[* TO ${this.escapeValue(value)}]`);
  }

  between(
    field: string,
    from: string | number,
    to: string | number,
    inclusive = true,
  ): this {
    const bracket = inclusive ? ['[', ']'] : ['{', '}'];
    return this.q(
      `${field}:${bracket[0]}${this.escapeValue(from)} TO ${this.escapeValue(to)}${bracket[1]}`,
    );
  }

  in(field: string, values: Array<string | number | boolean>): this {
    const joined = values.map((v) => `${this.escapeValue(v)}`).join(' OR ');
    return this.q(`${field}:( ${joined} )`);
  }

  phrase(field: string, phrase: string): this {
    return this.q(`${field}:"${this.escapePhrase(phrase)}"`);
  }

  startsWith(field: string, prefix: string): this {
    return this.q(`${field}:${this.escapeTerm(prefix)}*`);
  }

  exists(field: string): this {
    return this.q(`${field}:[* TO *]`);
  }

  notExists(field: string): this {
    return this.q(`-*:* OR -${field}:[* TO *]`);
  }

  and(): this {
    this.qParts.push('AND');
    return this;
  }

  or(): this {
    this.qParts.push('OR');
    return this;
  }

  group(open: boolean): this {
    this.qParts.push(open ? '(' : ')');
    return this;
  }

  // Filters and selection
  filter(query: string): this {
    this.filterQueries.push(query);
    return this;
  }

  matchFilter(field: string, value: string | number | boolean): this {
    this.filterQueries.push(`${field}:${this.escapeValue(value)}`);
    return this;
  }

  fields(fields: string[] | string): this {
    const list = Array.isArray(fields) ? fields : [fields];
    this.paramsMap['fl'] = list.join(',');
    return this;
  }

  facet(fields: string[] | string): this {
    const list = Array.isArray(fields) ? fields : [fields];
    this.paramsMap['facet'] = true;
    this.paramsMap['facet.field'] = list;
    return this;
  }

  sort(field: string, direction: SortDirection = 'asc'): this {
    this.paramsMap['sort'] = `${field} ${direction}`;
    return this;
  }

  start(offset: number): this {
    this.paramsMap['start'] = offset;
    return this;
  }

  rows(limit: number): this {
    this.paramsMap['rows'] = limit;
    return this;
  }

  cursor(mark: string = '*'): this {
    this.paramsMap['cursorMark'] = mark;
    return this;
  }

  params(extra: Record<string, string | number | boolean>): this {
    Object.entries(extra).forEach(([k, v]) => {
      this.paramsMap[k] = v as any;
    });
    return this;
  }

  rawParams(
    setter: (
      params: Record<string, string | number | boolean | string[]>,
    ) => void,
  ): this {
    setter(this.paramsMap as any);
    return this;
  }

  toParams(): Record<string, string | number | boolean | string[]> {
    const params: Record<string, string | number | boolean | string[]> = {
      ...this.paramsMap,
    };
    params['q'] = this.qParts.length ? this.qParts.join(' ') : '*:*';
    if (this.filterQueries.length) params['fq'] = this.filterQueries;
    return params;
  }

  private getQueryString(): string {
    return this.qParts.join(' ');
  }

  private escapeValue(value: string | number | boolean): string {
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value);
    return this.escapeTerm(value);
  }

  private escapeTerm(term: string): string {
    return term.replace(/([+\-!(){}\[\]^"~*?:\\/])/g, '\\$1');
  }

  private escapePhrase(phrase: string): string {
    return phrase.replace(/([\"\\])/g, '\\$1');
  }
}

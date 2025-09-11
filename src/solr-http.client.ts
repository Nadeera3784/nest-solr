import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export interface SolrClientOptions {
  host?: string;
  port?: number | string;
  core?: string;
  path?: string;
  secure?: boolean;
  basicAuth?: { username: string; password: string };
}

export type SolrSearchParams = Record<
  string,
  string | number | boolean | string[]
>;

export class SolrHttpClient {
  private readonly baseUrl: string;
  private readonly authHeader?: string;
  private readonly agent: http.Agent | https.Agent | undefined;

  constructor(private readonly options: SolrClientOptions = {}) {
    const protocol = options.secure ? 'https:' : 'http:';
    const host = options.host ?? 'localhost';
    const port = options.port ?? 8983;
    const basePath = options.path ?? '/solr';
    const core = options.core ? `/${encodeURIComponent(options.core)}` : '';
    this.baseUrl = `${protocol}//${host}:${port}${basePath}${core}`;

    if (options.basicAuth) {
      const token = Buffer.from(
        `${options.basicAuth.username}:${options.basicAuth.password}`,
      ).toString('base64');
      this.authHeader = `Basic ${token}`;
    }

    this.agent = options.secure
      ? new https.Agent({ keepAlive: true })
      : new http.Agent({ keepAlive: true });
  }

  async search(params: SolrSearchParams): Promise<any> {
    const url = new URL(this.baseUrl + '/select');
    this.appendParams(url, params);
    return this.request('GET', url);
  }

  async add(
    doc: Record<string, any> | Record<string, any>[],
    options?: { commitWithin?: number; overwrite?: boolean },
  ): Promise<any> {
    const body = Array.isArray(doc)
      ? { add: doc.map((d) => ({ doc: d, ...this.cleanUndefined(options) })) }
      : { add: { doc, ...this.cleanUndefined(options) } };
    const url = new URL(this.baseUrl + '/update');
    return this.request('POST', url, body);
  }

  async commit(): Promise<any> {
    const url = new URL(this.baseUrl + '/update');
    const body = { commit: { waitSearcher: true } };
    return this.request('POST', url, body);
  }

  async optimize(options?: {
    softCommit?: boolean;
    waitSearcher?: boolean;
    maxSegments?: number;
  }): Promise<any> {
    const url = new URL(this.baseUrl + '/update');
    url.searchParams.set('optimize', 'true');
    if (options?.softCommit !== undefined)
      url.searchParams.set('softCommit', String(options.softCommit));
    if (options?.waitSearcher !== undefined)
      url.searchParams.set('waitSearcher', String(options.waitSearcher));
    if (options?.maxSegments !== undefined)
      url.searchParams.set('maxSegments', String(options.maxSegments));
    return this.request('POST', url, {});
  }

  async deleteByID(id: string | number): Promise<any> {
    const url = new URL(this.baseUrl + '/update');
    const body = { delete: { id } };
    return this.request('POST', url, body);
  }

  async deleteByQuery(query: string): Promise<any> {
    const url = new URL(this.baseUrl + '/update');
    const body = { delete: { query } };
    return this.request('POST', url, body);
  }

  private async request(
    method: 'GET' | 'POST',
    url: URL,
    body?: any,
  ): Promise<any> {
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    let payload: string | undefined;
    if (method === 'POST') {
      payload = body ? JSON.stringify(body) : '';
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }
    if (this.authHeader) {
      headers['Authorization'] = this.authHeader;
    }

    return new Promise((resolve, reject) => {
      const req = transport.request(
        {
          method,
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + (url.search || ''),
          headers,
          agent: this.agent,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (d) =>
            chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)),
          );
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const contentType = res.headers['content-type'] || '';
            const text = buffer.toString('utf8');
            if (
              res.statusCode &&
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              if (contentType.includes('application/json')) {
                try {
                  resolve(JSON.parse(text));
                } catch {
                  resolve(text);
                }
              } else {
                resolve(text);
              }
            } else {
              const error = new Error(
                `Solr request failed: ${res.statusCode} ${res.statusMessage} - ${text}`,
              );
              reject(error);
            }
          });
        },
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  private appendParams(url: URL, params: SolrSearchParams): void {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, String(v)));
      } else {
        url.searchParams.set(key, String(value));
      }
    });
  }

  private cleanUndefined<T extends Record<string, any> | undefined>(
    obj: T,
  ): T | undefined {
    if (!obj) return obj;
    const out: Record<string, any> = {};
    Object.entries(obj).forEach(([k, v]) => {
      if (v !== undefined) out[k] = v;
    });
    return out as T;
  }
}

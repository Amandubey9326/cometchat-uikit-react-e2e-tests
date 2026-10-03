import { env } from '@config/env';
import { OWNED_PREFIX } from '@config/run';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly code: string | undefined,
    detail: string
  ) {
    super(`CometChat REST ${method} ${path} → ${status}${code ? ` ${code}` : ''}: ${detail}`);
  }
}

interface RequestOptions {
  body?: unknown;
  /** Act as this user (REST `onBehalfOf` header). */
  onBehalfOf?: string;
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Thin CometChat REST v3 client used for test-data setup and cleanup only —
 * never to prove a feature works (the UI does that). Retries rate limits and
 * transient server errors; never logs the API key.
 */
export class RestClient {
  constructor(
    private readonly base = env.restBase,
    private readonly headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      apikey: env.apiKey,
      appid: env.appId,
    }
  ) {}

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const headers = { ...this.headers, ...(options.onBehalfOf ? { onBehalfOf: options.onBehalfOf } : {}) };
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);

    for (let attempt = 1; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${this.base}${path}`, { method, headers, body });
      } catch (error) {
        // Network-level failure ("fetch failed": DNS, reset, TLS) — retry like a 5xx.
        if (attempt < MAX_ATTEMPTS) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw error;
      }
      const json = (await res.json().catch(() => ({}))) as {
        data?: T;
        error?: { code?: string; message?: string };
      };
      if (res.ok) return json.data as T;

      if (RETRYABLE.has(res.status) && attempt < MAX_ATTEMPTS) {
        const retryAfter = Number(res.headers.get('retry-after'));
        await sleep(retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
        continue;
      }
      throw new ApiError(res.status, method, path, json.error?.code, json.error?.message ?? res.statusText);
    }
  }

  get = <T>(path: string, options?: RequestOptions) => this.request<T>('GET', path, options);
  post = <T>(path: string, options?: RequestOptions) => this.request<T>('POST', path, options);
  put = <T>(path: string, options?: RequestOptions) => this.request<T>('PUT', path, options);
  delete = <T>(path: string, options?: RequestOptions) => this.request<T>('DELETE', path, options);
}

/** Refuses to touch anything the framework did not create. */
export function assertOwned(id: string): void {
  if (!id.startsWith(OWNED_PREFIX)) {
    throw new Error(`Refusing to modify "${id}": only ids starting with "${OWNED_PREFIX}" belong to the framework.`);
  }
}

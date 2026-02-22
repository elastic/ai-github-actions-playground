import type { components, operations } from "./types.generated";

// ---------------------------------------------------------------------------
// Convenience type aliases from the generated OpenAPI types
// ---------------------------------------------------------------------------

export type EsqlColumn = components["schemas"]["esql._types.EsqlColumnInfo"];
export type EsqlResult = components["schemas"]["esql._types.EsqlResult"];
export type AsyncEsqlResult = components["schemas"]["esql._types.AsyncEsqlResult"];

/** Request body for POST /_query */
export type EsqlQueryRequest =
  operations["esql-query"]["requestBody"]["content"]["application/json"];

/**
 * Practical query params — the OpenAPI-generated filter type requires fields
 * like `boost` that Elasticsearch treats as optional. This relaxed type lets
 * callers pass plain query-DSL objects for the filter while keeping the rest
 * of the request fully typed.
 */
export type EsqlQueryParams = Omit<EsqlQueryRequest, "filter"> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: Record<string, any>;
};

/** Response from POST /_query */
export type EsqlQueryResponse =
  operations["esql-query"]["responses"][200]["content"]["application/json"];

/** Response from GET / (cluster info) */
export type ClusterInfoResponse =
  operations["info"]["responses"][200]["content"]["application/json"];

/**
 * Backward-compatible alias — matches the shape components were already using.
 * `EsqlResult` has `columns` and `values` which is what `EsqlResponse` was.
 */
export type EsqlResponse = EsqlResult;

// ---------------------------------------------------------------------------
// Types that are NOT in the OpenAPI spec (our own)
// ---------------------------------------------------------------------------

export interface ElasticsearchConnection {
  url: string;
  apiKey?: string;
  username?: string;
  password?: string;
  cloudId?: string;
}

export interface ElasticsearchError {
  status: number;
  message: string;
  cause?: string;
}

/**
 * @deprecated Use `ElasticsearchError` instead. Kept for backward compatibility.
 */
export type EsqlError = ElasticsearchError;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const RETRY_STATUSES = new Set([429, 503]);
const INITIAL_BACKOFF_MS = 500;

export class ElasticsearchClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(connection: ElasticsearchConnection) {
    this.baseUrl = connection.url.replace(/\/+$/, "");
    this.headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (connection.username && connection.password) {
      const bytes = new TextEncoder().encode(`${connection.username}:${connection.password}`);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const credentials = btoa(binary);
      this.headers["Authorization"] = `Basic ${credentials}`;
    } else if (connection.apiKey) {
      this.headers["Authorization"] = `ApiKey ${connection.apiKey}`;
    }
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async _fetch<T>(
    path: string,
    options?: RequestInit & { signal?: AbortSignal },
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      ...options,
      headers: { ...this.headers, ...(options?.headers as Record<string, string>) },
    };

    let lastError: ElasticsearchError | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const response = await fetch(url, init);

      if (response.ok) {
        return (await response.json()) as T;
      }

      const body = await response.json().catch(() => ({}));
      const esError: ElasticsearchError = {
        status: response.status,
        message:
          body?.error?.reason ??
          body?.error?.root_cause?.[0]?.reason ??
          body?.message ??
          response.statusText,
        cause: body?.error?.caused_by?.reason,
      };

      if (!RETRY_STATUSES.has(response.status) || attempt === MAX_RETRIES - 1) {
        throw esError;
      }

      lastError = esError;
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }

    // Should never reach here, but satisfy TypeScript
    throw lastError ?? new Error("Unexpected error in _fetch");
  }

  // -------------------------------------------------------------------------
  // ES|QL
  // -------------------------------------------------------------------------

  async query(
    params: EsqlQueryParams,
    signal?: AbortSignal,
  ): Promise<EsqlQueryResponse & { executionTimeMs: number }> {
    const start = Date.now();
    const data = await this._fetch<EsqlQueryResponse>("/_query?format=json", {
      method: "POST",
      body: JSON.stringify(params),
      signal,
    });
    return { ...data, executionTimeMs: Date.now() - start };
  }

  // -------------------------------------------------------------------------
  // Cluster
  // -------------------------------------------------------------------------

  async getClusterInfo(signal?: AbortSignal): Promise<ClusterInfoResponse> {
    return this._fetch<ClusterInfoResponse>("/", { signal });
  }
}

// ---------------------------------------------------------------------------
// Standalone helpers (backwards-compatible convenience)
// ---------------------------------------------------------------------------

export function isElasticsearchError(err: unknown): err is ElasticsearchError {
  return typeof err === "object" && err !== null && "status" in err && "message" in err;
}

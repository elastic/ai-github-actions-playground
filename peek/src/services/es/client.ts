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
export type EsqlQueryParams = Omit<EsqlQueryRequest, "filter" | "params"> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: Record<string, any>;
  params?: Array<Record<string, string>> | EsqlQueryRequest["params"];
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

/**
 * Capabilities derived from the user's API key / credentials.
 * Used to gate UI features based on what the user is allowed to do.
 */
export interface UserCapabilities {
  /** Whether the user can manage data streams (create, delete, rollover, etc.) */
  canManageDataStreams: boolean;
}

/** Shape of the `POST /_security/user/_has_privileges` response (subset we use). */
interface HasPrivilegesResponse {
  cluster?: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const RETRY_STATUSES = new Set([429, 503]);
const INITIAL_BACKOFF_MS = 500;

function sleepAbortable(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

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
    const signal = init.signal;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, init);
      } catch (err) {
        throw {
          status: 0,
          message: err instanceof Error ? err.message : String(err),
        } satisfies ElasticsearchError;
      }

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
      await sleepAbortable(backoff, signal);
    }

    // Should never reach here, but satisfy TypeScript
    throw (
      lastError ??
      ({
        status: 0,
        message: "Unexpected error while contacting Elasticsearch",
      } satisfies ElasticsearchError)
    );
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

  // -------------------------------------------------------------------------
  // Security / capabilities
  // -------------------------------------------------------------------------

  /**
   * Queries the Elasticsearch security API to determine what the current
   * credential is allowed to do.  Falls back to a safe minimal set when the
   * security API is unavailable (e.g. un-secured clusters or CORS limits).
   */
  async getCapabilities(signal?: AbortSignal): Promise<UserCapabilities> {
    try {
      const response = await this._fetch<HasPrivilegesResponse>("/_security/user/_has_privileges", {
        method: "POST",
        body: JSON.stringify({ cluster: ["manage_data_stream"] }),
        signal,
      });
      return {
        canManageDataStreams: response.cluster?.["manage_data_stream"] ?? false,
      };
    } catch {
      // Security API may be unavailable on older / un-secured clusters; default to no extra privileges.
      return { canManageDataStreams: false };
    }
  }
}

// ---------------------------------------------------------------------------
// Standalone helpers (backwards-compatible convenience)
// ---------------------------------------------------------------------------

export function isElasticsearchError(err: unknown): err is ElasticsearchError {
  if (typeof err !== "object" || err === null) return false;
  const obj = err as Record<string, unknown>;
  return typeof obj.status === "number" && typeof obj.message === "string";
}

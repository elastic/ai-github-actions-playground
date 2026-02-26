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
  params?: Array<Record<string, string | number | boolean>> | EsqlQueryRequest["params"];
};

/** Response from POST /_query */
export type EsqlQueryResponse =
  operations["esql-query"]["responses"][200]["content"]["application/json"];

/** Response from GET / (cluster info) */
export type ClusterInfoResponse =
  operations["info"]["responses"][200]["content"]["application/json"];
export interface ClusterHealthResponse {
  status?: "green" | "yellow" | "red";
  number_of_nodes?: number;
  number_of_data_nodes?: number;
  active_primary_shards?: number;
  active_shards?: number;
  unassigned_shards?: number;
}
export interface ClusterStatsResponse {
  indices?: {
    count?: number;
    shards?: { total?: number };
    docs?: { count?: number };
    store?: { size_in_bytes?: number };
  };
  nodes?: {
    count?: { total?: number };
  };
}
export interface NodesInfoNode {
  name?: string;
  roles?: string[];
  version?: string;
}
export interface NodesInfoResponse {
  nodes?: Record<string, NodesInfoNode>;
}
export interface NodeStatsNode {
  name?: string;
  os?: { cpu?: { percent?: number } };
  jvm?: { mem?: { heap_used_percent?: number } };
  fs?: { total?: { total_in_bytes?: number; available_in_bytes?: number } };
  indices?: {
    docs?: { count?: number };
    shard_stats?: { total_count?: number };
  };
}
export interface NodesStatsResponse {
  nodes?: Record<string, NodeStatsNode>;
}
export type ResolveIndexResponse =
  operations["indices-resolve-index"]["responses"][200]["content"]["application/json"];
export type GetDataStreamsResponse =
  operations["indices-get-data-stream"]["responses"][200]["content"]["application/json"];
export type DataStreamInfo = GetDataStreamsResponse["data_streams"][number];
export type ResolveIndexDataStreamInfo = ResolveIndexResponse["data_streams"][number];
export type FieldCapsResponse =
  operations["field-caps-2"]["responses"][200]["content"]["application/json"];
export type FieldCapability = components["schemas"]["_global.field_caps.FieldCapability"];
export interface SecurityUser {
  username: string;
  enabled?: boolean;
  roles?: string[];
  full_name?: string | null;
  email?: string | null;
  metadata?: Record<string, unknown>;
}
export interface SecurityRoleIndexPrivilege {
  names?: string[];
  privileges?: string[];
}
export interface SecurityRole {
  cluster?: string[];
  indices?: SecurityRoleIndexPrivilege[];
  run_as?: string[];
  metadata?: Record<string, unknown>;
}
export type GetSecurityUsersResponse = Record<string, SecurityUser>;
export type GetSecurityRolesResponse = Record<string, SecurityRole>;
export interface ProfilingTopFunctionsRequest {
  limit: number;
  query: {
    bool: {
      filter: Array<Record<string, unknown>>;
    };
  };
}

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
  proxyUrl?: string;
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
  /** Whether the user can read user definitions from the security API. */
  canReadSecurityUsers: boolean;
  /** Whether the user can read role definitions from the security API. */
  canReadSecurityRoles: boolean;
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
const RAW_REQUEST_TIMEOUT_MS = 30_000;

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
    this.baseUrl = (connection.proxyUrl || connection.url).replace(/\/+$/, "");
    this.headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (connection.proxyUrl) {
      this.headers["X-Elastic-Peek-Proxy-Host"] = connection.url;
    }

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

  /**
   * Execute a single HTTP request, routing through the Electron main process
   * when running inside the Electron shell (bypasses CORS) or falling back to
   * browser fetch for the web build.
   */
  private async _doFetch(
    url: string,
    mergedHeaders: Record<string, string>,
    options?: RequestInit & { signal?: AbortSignal },
  ): Promise<Response> {
    const signal = options?.signal;

    if (typeof window !== "undefined" && window.electronAPI?.isElectron) {
      // Electron: route through the main process — no CORS restrictions apply
      if (signal?.aborted) throw signal.reason;
      const ipcPromise = window.electronAPI.fetchES({
        url,
        method: options?.method as string | undefined,
        headers: mergedHeaders,
        body: options?.body as string | undefined,
      });
      const abortPromise =
        signal &&
        new Promise<never>((_, reject) => {
          const onAbort = () => {
            reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
          };
          signal.addEventListener("abort", onAbort, { once: true });
          ipcPromise.finally(() => signal.removeEventListener("abort", onAbort));
        });
      const ipcResp = await (abortPromise ? Promise.race([ipcPromise, abortPromise]) : ipcPromise);
      if (signal?.aborted) throw signal.reason;
      return new Response(ipcResp.body, {
        status: ipcResp.status,
        statusText: ipcResp.statusText,
        headers: { "content-type": ipcResp.contentType },
      });
    }

    // Web: standard browser fetch (may require the /_es proxy for CORS)
    return fetch(url, { ...options, headers: mergedHeaders });
  }

  private async _fetch<T>(
    path: string,
    options?: RequestInit & { signal?: AbortSignal },
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const mergedHeaders = {
      ...this.headers,
      ...(options?.headers as Record<string, string>),
    };

    let lastError: ElasticsearchError | undefined;
    const signal = options?.signal;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let response: Response;
      try {
        response = await this._doFetch(url, mergedHeaders, options);
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

  async getClusterHealth(signal?: AbortSignal): Promise<ClusterHealthResponse> {
    return this._fetch<ClusterHealthResponse>("/_cluster/health", { signal });
  }

  async getClusterStats(signal?: AbortSignal): Promise<ClusterStatsResponse> {
    return this._fetch<ClusterStatsResponse>("/_cluster/stats", { signal });
  }

  async getNodes(signal?: AbortSignal): Promise<NodesInfoResponse> {
    return this._fetch<NodesInfoResponse>("/_nodes", { signal });
  }

  async getNodeStats(signal?: AbortSignal): Promise<NodesStatsResponse> {
    return this._fetch<NodesStatsResponse>("/_nodes/stats", { signal });
  }

  async resolveIndex(name: string, signal?: AbortSignal): Promise<ResolveIndexResponse> {
    return this._fetch<ResolveIndexResponse>(`/_resolve/index/${encodeURIComponent(name)}`, {
      signal,
    });
  }

  async getDataStreams(name?: string, signal?: AbortSignal): Promise<GetDataStreamsResponse> {
    const path = name ? `/_data_stream/${encodeURIComponent(name)}` : "/_data_stream";
    return this._fetch<GetDataStreamsResponse>(path, { signal });
  }

  async getFieldCaps(
    index: string,
    fields?: string[],
    signal?: AbortSignal,
  ): Promise<FieldCapsResponse> {
    const params = new URLSearchParams();
    const normalizedFields = fields?.map((field) => field.trim()).filter(Boolean) ?? [];
    params.set("fields", normalizedFields.length > 0 ? normalizedFields.join(",") : "*");
    const query = params.toString();
    const path = `/${encodeURIComponent(index)}/_field_caps${query ? `?${query}` : ""}`;
    return this._fetch<FieldCapsResponse>(path, { signal });
  }

  async getSecurityUsers(signal?: AbortSignal): Promise<GetSecurityUsersResponse> {
    return this._fetch<GetSecurityUsersResponse>("/_security/user", { signal });
  }

  async getSecurityRoles(signal?: AbortSignal): Promise<GetSecurityRolesResponse> {
    return this._fetch<GetSecurityRolesResponse>("/_security/role", { signal });
  }

  async getTopFunctions(
    body: ProfilingTopFunctionsRequest,
    signal?: AbortSignal,
  ): Promise<unknown> {
    return this._fetch<unknown>("/_profiling/topn/functions", {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
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
        body: JSON.stringify({
          cluster: ["manage_data_stream", "read_security", "manage_security"],
        }),
        signal,
      });
      const canReadSecurity = Boolean(
        response.cluster?.["read_security"] || response.cluster?.["manage_security"],
      );
      return {
        canManageDataStreams: response.cluster?.["manage_data_stream"] ?? false,
        canReadSecurityUsers: canReadSecurity,
        canReadSecurityRoles: canReadSecurity,
      };
    } catch {
      // Security API may be unavailable on older / un-secured clusters; default to no extra privileges.
      return {
        canManageDataStreams: false,
        canReadSecurityUsers: false,
        canReadSecurityRoles: false,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Raw request (API console)
  // -------------------------------------------------------------------------

  /** Execute an arbitrary HTTP request against the connected Elasticsearch cluster. */
  async rawRequest(
    method: string,
    path: string,
    body?: string,
    signal?: AbortSignal,
  ): Promise<{ status: number; body: unknown }> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new DOMException("Request timed out", "AbortError"));
    }, RAW_REQUEST_TIMEOUT_MS);
    const onAbort = () => {
      controller.abort(signal?.reason);
    };
    if (signal?.aborted) {
      onAbort();
    } else {
      signal?.addEventListener("abort", onAbort, { once: true });
    }
    const rawBody = body && body.trim() ? body : undefined;
    let response: Response;
    try {
      response = await this._doFetch(
        url,
        { ...this.headers },
        {
          method,
          body: rawBody,
          signal: controller.signal,
        },
      );
    } catch (err) {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      throw {
        status: 0,
        message: err instanceof Error ? err.message : String(err),
      } satisfies ElasticsearchError;
    }
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onAbort);
    const contentType = response.headers.get("content-type") ?? "";
    let responseBody: unknown;
    if (contentType.includes("application/json")) {
      responseBody = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => "");
      responseBody = text || null;
    }
    return { status: response.status, body: responseBody };
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

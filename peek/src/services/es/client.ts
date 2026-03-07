import type { z } from "zod";

import { executeRawRequest } from "./rawRequest";
import { RETRY_STATUSES, MAX_RETRIES, INITIAL_BACKOFF_MS, sleepWithJitter } from "./retryUtils";
import {
  validateResponse,
  esqlQueryResponseSchema,
  clusterHealthResponseSchema,
  clusterStatsResponseSchema,
  nodesInfoResponseSchema,
  nodesStatsResponseSchema,
  catIndicesResponseSchema,
  fieldCapsResponseSchema,
  getDataStreamsResponseSchema,
  getIngestPipelinesResponseSchema,
} from "./responseSchemas";
import type { EsqlQueryParams, EsqlQueryResponse } from "./esqlTypes";
import type {
  ClusterInfoResponse,
  ClusterHealthResponse,
  ClusterStatsResponse,
  ClusterPendingTasksResponse,
  NodesInfoResponse,
  NodesStatsResponse,
  CatAllocationRecord,
  CatShardRecord,
  RecoveryResponse,
  SlmStatsResponse,
  SnapshotStatusResponse,
  ClusterSettingsResponse,
  ClusterAllocationExplainResponse,
  TasksListResponse,
} from "./clusterTypes";
import type {
  ResolveIndexResponse,
  GetDataStreamsResponse,
  FieldCapsResponse,
  CatIndexRecord,
  IndexStatsResponse,
  DiskUsageResponse,
} from "./indicesTypes";
import type {
  GetSecurityUsersResponse,
  GetSecurityRolesResponse,
  GetApiKeysResponse,
  UserCapabilities,
} from "./securityTypes";
import type { GetIngestPipelinesResponse, SimulateIngestPipelineResponse } from "./ingestTypes";
import type { ProfilingTopFunctionsRequest } from "./profilingTypes";
import type { GetWatchResponse, QueryWatchesRequest, QueryWatchesResponse } from "./watcherTypes";
import type { ListTasksResponse } from "./taskTypes";
import type { GetIlmPoliciesResponse, IlmExplainDetailResponse } from "./ilmTypes";
import type {
  GetIndexTemplatesResponse,
  GetComponentTemplatesResponse,
  SimulateIndexTemplateResponse,
} from "./templateTypes";
import type {
  GetSnapshotsResponse,
  GetRepositoriesResponse,
  GetSlmPoliciesResponse,
  GetSearchableSnapshotsCacheStatsResponse,
} from "./snapshotTypes";

// ---------------------------------------------------------------------------
// Re-export domain types so existing `import … from "./client"` keeps working.
// New types should be added to the corresponding domain type module.
// ---------------------------------------------------------------------------

export type {
  EsqlColumn,
  EsqlResult,
  AsyncEsqlResult,
  EsqlQueryRequest,
  EsqlQueryParams,
  EsqlQueryResponse,
  EsqlResponse,
} from "./esqlTypes";

export type {
  ClusterInfoResponse,
  ClusterHealthResponse,
  ClusterPendingTask,
  ClusterPendingTasksResponse,
  CatAllocationRecord,
  CatShardRecord,
  ClusterStatsResponse,
  NodesInfoNode,
  NodesInfoResponse,
  NodeStatsNode,
  NodesStatsResponse,
  RecoveryShardStatus,
  RecoveryResponse,
  IlmExplainIndexStatus,
  IlmExplainResponse,
  IlmPolicyResponse,
  SlmPolicyStats,
  SlmStatsResponse,
  SnapshotShardStats,
  SnapshotStatusRecord,
  SnapshotStatusResponse,
  NodesIngestPipelineStats,
  NodesIngestNodeStats,
  NodesIngestStatsResponse,
  ClusterSettingsResponse,
  ClusterAllocationExplainResponse,
  TasksListResponse,
} from "./clusterTypes";

export type {
  ResolveIndexResponse,
  GetDataStreamsResponse,
  DataStreamInfo,
  ResolveIndexDataStreamInfo,
  FieldCapsResponse,
  FieldCapability,
  CatIndexRecord,
  IndexStatsData,
  IndexStatsResponse,
  DiskUsageFieldStats,
  DiskUsageIndexEntry,
  DiskUsageResponse,
} from "./indicesTypes";

export type {
  SecurityUser,
  SecurityRole,
  SecurityRoleIndexPrivilege,
  GetSecurityUsersResponse,
  GetSecurityRolesResponse,
  ApiKeyInfo,
  GetApiKeysResponse,
  UserCapabilities,
} from "./securityTypes";

export type {
  IngestPipeline,
  GetIngestPipelinesResponse,
  SimulateIngestPipelineResponse,
} from "./ingestTypes";

export type { ProfilingTopFunctionsRequest } from "./profilingTypes";
export type { GetWatchResponse, QueryWatchesRequest, QueryWatchesResponse } from "./watcherTypes";

export type { TaskInfo, ListTasksResponse, TaskRow } from "./taskTypes";

export type {
  IlmPolicy,
  IlmPhaseDefinition,
  GetIlmPoliciesResponse,
  IlmExplainIndexDetail,
  IlmExplainDetailResponse,
  IlmIndexRow,
  IlmPolicyRow,
} from "./ilmTypes";

export type {
  IndexTemplateRecord,
  GetIndexTemplatesResponse,
  ComponentTemplateRecord,
  GetComponentTemplatesResponse,
  SimulateIndexTemplateResponse,
  IndexTemplateRow,
  ComponentTemplateRow,
} from "./templateTypes";

// ---------------------------------------------------------------------------
// Types that are NOT in the OpenAPI spec (our own)
// ---------------------------------------------------------------------------

export interface ElasticsearchConnection {
  url: string;
  apiKey?: string;
  username?: string;
  password?: string;
  proxyUrl?: string;
  ingestUrl?: string;
  otlpEnabled?: boolean;
  otlpEndpoint?: string;
  otlpUseElasticAuth?: boolean;
  otlpApiKey?: string;
}

export interface ElasticsearchError {
  status: number;
  message: string;
  cause?: string;
}

/** Shape of the `POST /_security/user/_has_privileges` response (subset we use). */
interface HasPrivilegesResponse {
  cluster?: Record<string, boolean>;
}

interface CreateApiKeyResponse {
  id: string;
  name: string;
  api_key: string;
  encoded?: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

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

    /* eslint-disable no-await-in-loop -- sequential retry with backoff */
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let response: Response;
      try {
        response = await this._doFetch(url, mergedHeaders, options);
      } catch (err: unknown) {
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
      await sleepWithJitter(backoff, signal);
    }
    /* eslint-enable no-await-in-loop */

    // Should never reach here, but satisfy TypeScript
    throw (
      lastError ??
      ({
        status: 0,
        message: "Unexpected error while contacting Elasticsearch",
      } satisfies ElasticsearchError)
    );
  }

  private async _fetchText(
    path: string,
    options?: RequestInit & { signal?: AbortSignal },
  ): Promise<string> {
    const url = `${this.baseUrl}${path}`;
    const mergedHeaders = {
      ...this.headers,
      ...(options?.headers as Record<string, string>),
    };

    let lastError: ElasticsearchError | undefined;
    const signal = options?.signal;

    /* eslint-disable no-await-in-loop -- sequential retry with backoff */
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let response: Response;
      try {
        response = await this._doFetch(url, mergedHeaders, options);
      } catch (err: unknown) {
        throw {
          status: 0,
          message: err instanceof Error ? err.message : String(err),
        } satisfies ElasticsearchError;
      }

      if (response.ok) {
        return await response.text();
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
      await sleepWithJitter(backoff, signal);
    }
    /* eslint-enable no-await-in-loop */

    throw (
      lastError ??
      ({
        status: 0,
        message: "Unexpected error while contacting Elasticsearch",
      } satisfies ElasticsearchError)
    );
  }

  /**
   * Like `_fetch`, but validates the response against a zod schema before
   * returning.  Validation failures are thrown as `ElasticsearchError` so
   * callers get an actionable message instead of a cryptic render crash.
   *
   * The schema is intentionally permissive (`.passthrough()`) — it validates
   * the fields the app depends on while allowing extra fields through.  The
   * return type `T` is the narrower TypeScript type the caller expects.
   */
  private async _fetchValidated<T>(
    path: string,
    schema: z.ZodTypeAny,
    label: string,
    options?: RequestInit & { signal?: AbortSignal },
  ): Promise<T> {
    const raw = await this._fetch<unknown>(path, options);
    return validateResponse(schema, raw, label) as T;
  }

  // -------------------------------------------------------------------------
  // ES|QL
  // -------------------------------------------------------------------------

  async query(
    params: EsqlQueryParams,
    signal?: AbortSignal,
  ): Promise<EsqlQueryResponse & { executionTimeMs: number }> {
    const start = Date.now();
    // The ES|QL _query API expects named params as an array of single-key
    // objects (e.g. [{"_tstart":"…"}, {"_tend":"…"}]).  Internally we build
    // params as a plain object for ergonomics, so convert here at the
    // serialisation boundary.
    const body: Record<string, unknown> = { ...params };
    if (body.params && !Array.isArray(body.params)) {
      body.params = Object.entries(body.params as Record<string, unknown>).map(([k, v]) => ({
        [k]: v,
      }));
    }
    const data = await this._fetchValidated<EsqlQueryResponse>(
      "/_query?format=json",
      esqlQueryResponseSchema,
      "ES|QL query",
      {
        method: "POST",
        body: JSON.stringify(body),
        signal,
      },
    );
    return { ...data, executionTimeMs: Date.now() - start };
  }

  // -------------------------------------------------------------------------
  // Cluster
  // -------------------------------------------------------------------------

  async getClusterInfo(signal?: AbortSignal): Promise<ClusterInfoResponse> {
    return this._fetch<ClusterInfoResponse>("/", { signal });
  }

  async getClusterHealth(
    level?: "cluster" | "indices" | "shards",
    signal?: AbortSignal,
  ): Promise<ClusterHealthResponse> {
    const path = level ? `/_cluster/health?level=${level}` : "/_cluster/health";
    return this._fetchValidated<ClusterHealthResponse>(
      path,
      clusterHealthResponseSchema,
      "cluster health",
      { signal },
    );
  }

  async getClusterStats(signal?: AbortSignal): Promise<ClusterStatsResponse> {
    return this._fetchValidated<ClusterStatsResponse>(
      "/_cluster/stats",
      clusterStatsResponseSchema,
      "cluster stats",
      { signal },
    );
  }

  async getPendingTasks(signal?: AbortSignal): Promise<ClusterPendingTasksResponse> {
    return this._fetch<ClusterPendingTasksResponse>("/_cluster/pending_tasks", { signal });
  }

  async getNodes(signal?: AbortSignal): Promise<NodesInfoResponse> {
    return this._fetchValidated<NodesInfoResponse>(
      "/_nodes",
      nodesInfoResponseSchema,
      "nodes info",
      { signal },
    );
  }

  async getNodeStats(signal?: AbortSignal): Promise<NodesStatsResponse> {
    return this._fetchValidated<NodesStatsResponse>(
      "/_nodes/stats/os,jvm,process,thread_pool,breaker,indices,fs,ingest,transport,http",
      nodesStatsResponseSchema,
      "nodes stats",
      { signal },
    );
  }

  async getCatAllocation(signal?: AbortSignal): Promise<CatAllocationRecord[]> {
    return this._fetch<CatAllocationRecord[]>("/_cat/allocation?format=json&bytes=b", { signal });
  }

  async getCatShards(signal?: AbortSignal): Promise<CatShardRecord[]> {
    return this._fetch<CatShardRecord[]>(
      "/_cat/shards?format=json&bytes=b&h=index,shard,prirep,state,docs,store,node,unassigned.reason",
      { signal },
    );
  }

  async getRecoveryStatus(signal?: AbortSignal): Promise<RecoveryResponse> {
    return this._fetch<RecoveryResponse>("/_recovery?active_only=true", { signal });
  }

  async getIlmExplainAll(signal?: AbortSignal): Promise<IlmExplainDetailResponse> {
    return this.getIlmExplain(signal);
  }

  async getTasksDetailed(signal?: AbortSignal): Promise<TasksListResponse> {
    return this._fetch<TasksListResponse>("/_tasks?detailed=true", { signal });
  }

  async getSlmStats(signal?: AbortSignal): Promise<SlmStatsResponse> {
    return this._fetch<SlmStatsResponse>("/_slm/stats", { signal });
  }

  async getSnapshotStatus(signal?: AbortSignal): Promise<SnapshotStatusResponse> {
    // Use the generic status endpoint so we can fetch repository-wide snapshot state.
    // `/_snapshot/_all/_current` is less portable across cluster versions/configs.
    return this._fetch<SnapshotStatusResponse>("/_snapshot/_status", { signal });
  }

  async getSnapshots(signal?: AbortSignal): Promise<GetSnapshotsResponse> {
    return this._fetch<GetSnapshotsResponse>("/_snapshot/*/*?verbose=false", { signal });
  }

  async getRepositories(signal?: AbortSignal): Promise<GetRepositoriesResponse> {
    return this._fetch<GetRepositoriesResponse>("/_snapshot", { signal });
  }

  async getSlmPolicies(signal?: AbortSignal): Promise<GetSlmPoliciesResponse> {
    return this._fetch<GetSlmPoliciesResponse>("/_slm/policy?human", { signal });
  }

  async getSearchableSnapshotsCacheStats(
    signal?: AbortSignal,
  ): Promise<GetSearchableSnapshotsCacheStatsResponse> {
    return this._fetch<GetSearchableSnapshotsCacheStatsResponse>(
      "/_searchable_snapshots/cache/stats",
      { signal },
    );
  }

  async getClusterSettings(signal?: AbortSignal): Promise<ClusterSettingsResponse> {
    return this._fetch<ClusterSettingsResponse>(
      "/_cluster/settings?include_defaults=true&flat_settings=true",
      { signal },
    );
  }

  async getNodesHotThreads(
    options?: {
      nodeId?: string;
      ignoreIdleThreads?: boolean;
      interval?: string;
      snapshots?: number;
      threads?: number;
      timeout?: string;
      type?: "cpu" | "wait" | "block" | "gpu" | "mem";
      sort?: "cpu" | "wait" | "block" | "gpu" | "mem";
    },
    signal?: AbortSignal,
  ): Promise<string> {
    const basePath = options?.nodeId?.trim()
      ? `/_nodes/${encodeURIComponent(options.nodeId.trim())}/hot_threads`
      : "/_nodes/hot_threads";
    const params = new URLSearchParams();
    if (options?.ignoreIdleThreads !== undefined) {
      params.set("ignore_idle_threads", String(options.ignoreIdleThreads));
    }
    if (options?.interval) params.set("interval", options.interval);
    if (options?.snapshots !== undefined) params.set("snapshots", String(options.snapshots));
    if (options?.threads !== undefined) params.set("threads", String(options.threads));
    if (options?.timeout) params.set("timeout", options.timeout);
    if (options?.type) params.set("type", options.type);
    if (options?.sort) params.set("sort", options.sort);
    const query = params.toString();
    return this._fetchText(query ? `${basePath}?${query}` : basePath, {
      signal,
      headers: {
        Accept: "text/plain",
      },
    });
  }

  async getAllocationExplain(signal?: AbortSignal): Promise<ClusterAllocationExplainResponse> {
    return this._fetch<ClusterAllocationExplainResponse>("/_cluster/allocation/explain", {
      method: "POST",
      body: JSON.stringify({}),
      signal,
    });
  }

  async resolveIndex(name: string, signal?: AbortSignal): Promise<ResolveIndexResponse> {
    return this._fetch<ResolveIndexResponse>(`/_resolve/index/${encodeURIComponent(name)}`, {
      signal,
    });
  }

  async getDataStreams(name?: string, signal?: AbortSignal): Promise<GetDataStreamsResponse> {
    const path = name ? `/_data_stream/${encodeURIComponent(name)}` : "/_data_stream";
    return this._fetchValidated<GetDataStreamsResponse>(
      path,
      getDataStreamsResponseSchema,
      "data streams",
      {
        signal,
      },
    );
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
    return this._fetchValidated<FieldCapsResponse>(path, fieldCapsResponseSchema, "field caps", {
      signal,
    });
  }

  async getCatIndices(signal?: AbortSignal): Promise<CatIndexRecord[]> {
    return this._fetchValidated<CatIndexRecord[]>(
      "/_cat/indices?format=json&bytes=b",
      catIndicesResponseSchema,
      "cat indices",
      { signal },
    );
  }

  async getIndexStats(index: string, signal?: AbortSignal): Promise<IndexStatsResponse> {
    return this._fetch<IndexStatsResponse>(`/${encodeURIComponent(index)}/_stats`, { signal });
  }

  async getIndexMappings(index: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    return this._fetch<Record<string, unknown>>(`/${encodeURIComponent(index)}/_mapping`, {
      signal,
    });
  }

  async getIndexSettings(index: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    return this._fetch<Record<string, unknown>>(`/${encodeURIComponent(index)}/_settings`, {
      signal,
    });
  }

  async getIndexDiskUsage(index: string, signal?: AbortSignal): Promise<DiskUsageResponse> {
    return this._fetch<DiskUsageResponse>(
      `/${encodeURIComponent(index)}/_disk_usage?run_expensive_tasks=true`,
      { method: "POST", signal },
    );
  }

  async getSecurityUsers(signal?: AbortSignal): Promise<GetSecurityUsersResponse> {
    return this._fetch<GetSecurityUsersResponse>("/_security/user", { signal });
  }

  async getSecurityRoles(signal?: AbortSignal): Promise<GetSecurityRolesResponse> {
    return this._fetch<GetSecurityRolesResponse>("/_security/role", { signal });
  }

  async getApiKeys(signal?: AbortSignal): Promise<GetApiKeysResponse> {
    return this._fetch<GetApiKeysResponse>("/_security/api_key", { signal });
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

  async getIngestPipelines(signal?: AbortSignal): Promise<GetIngestPipelinesResponse> {
    return this._fetchValidated<GetIngestPipelinesResponse>(
      "/_ingest/pipeline",
      getIngestPipelinesResponseSchema,
      "ingest pipelines",
      { signal },
    );
  }

  async simulateIngestPipeline(
    pipelineId: string,
    docs: Array<Record<string, unknown>>,
    options?: { verbose?: boolean },
    signal?: AbortSignal,
  ): Promise<SimulateIngestPipelineResponse> {
    const body: Record<string, unknown> = { docs };
    if (options?.verbose) body.verbose = true;
    return this._fetch<SimulateIngestPipelineResponse>(
      `/_ingest/pipeline/${encodeURIComponent(pipelineId)}/_simulate`,
      {
        method: "POST",
        body: JSON.stringify(body),
        signal,
      },
    );
  }

  async getWatcherWatch(id: string, signal?: AbortSignal): Promise<GetWatchResponse> {
    return this._fetch<GetWatchResponse>(`/_watcher/watch/${encodeURIComponent(id)}`, { signal });
  }

  async queryWatcherWatches(
    request: QueryWatchesRequest = {},
    signal?: AbortSignal,
  ): Promise<QueryWatchesResponse> {
    return this._fetch<QueryWatchesResponse>("/_watcher/_query/watches", {
      method: "POST",
      body: JSON.stringify(request),
      signal,
    });
  }

  // -------------------------------------------------------------------------
  // Task Management
  // -------------------------------------------------------------------------

  async listTasks(signal?: AbortSignal): Promise<ListTasksResponse> {
    return this._fetch<ListTasksResponse>("/_tasks?detailed=true&group_by=none", { signal });
  }

  async cancelTask(taskId: string, signal?: AbortSignal): Promise<unknown> {
    return this._fetch<unknown>(`/_tasks/${encodeURIComponent(taskId)}/_cancel`, {
      method: "POST",
      signal,
    });
  }

  // -------------------------------------------------------------------------
  // ILM (Index Lifecycle Management)
  // -------------------------------------------------------------------------

  async getIlmPolicies(signal?: AbortSignal): Promise<GetIlmPoliciesResponse> {
    return this._fetch<GetIlmPoliciesResponse>("/_ilm/policy", { signal });
  }

  async getIlmExplain(signal?: AbortSignal): Promise<IlmExplainDetailResponse> {
    return this._fetch<IlmExplainDetailResponse>("/_all/_ilm/explain?only_managed=true", {
      signal,
    });
  }

  // -------------------------------------------------------------------------
  // Index & Component Templates
  // -------------------------------------------------------------------------

  async getIndexTemplates(signal?: AbortSignal): Promise<GetIndexTemplatesResponse> {
    return this._fetch<GetIndexTemplatesResponse>("/_index_template", { signal });
  }

  async getComponentTemplates(signal?: AbortSignal): Promise<GetComponentTemplatesResponse> {
    return this._fetch<GetComponentTemplatesResponse>("/_component_template", { signal });
  }

  async simulateIndexTemplate(
    name: string,
    signal?: AbortSignal,
  ): Promise<SimulateIndexTemplateResponse> {
    return this._fetch<SimulateIndexTemplateResponse>(
      `/_index_template/_simulate/${encodeURIComponent(name)}`,
      { method: "POST", signal },
    );
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
          cluster: [
            "manage",
            "read_security",
            "manage_security",
            "manage_own_api_key",
            "manage_api_key",
            "read_pipeline",
            "manage_ingest_pipelines",
          ],
        }),
        signal,
      });
      const canReadSecurity = Boolean(
        response.cluster?.["read_security"] || response.cluster?.["manage_security"],
      );
      const canCreateApiKeys = Boolean(
        response.cluster?.["manage_own_api_key"] || response.cluster?.["manage_api_key"],
      );
      const canReadIngestPipelines = Boolean(
        response.cluster?.["read_pipeline"] || response.cluster?.["manage_ingest_pipelines"],
      );
      return {
        canManageDataStreams: response.cluster?.["manage"] ?? false,
        canCreateApiKeys,
        canReadSecurityUsers: canReadSecurity,
        canReadSecurityRoles: canReadSecurity,
        canReadApiKeys: canCreateApiKeys,
        canReadIngestPipelines,
      };
    } catch (err: unknown) {
      if (isElasticsearchError(err)) {
        // A 404 means the _has_privileges endpoint could not be found (e.g. a
        // proxy or middleware stripping the route).  This does NOT indicate that
        // the user lacks privileges, so return an optimistic set and let the
        // actual operation surface a clear error if it also fails.
        if (err.status === 404) {
          return {
            canManageDataStreams: true,
            canCreateApiKeys: true,
            canReadSecurityUsers: true,
            canReadSecurityRoles: true,
            canReadApiKeys: true,
            canReadIngestPipelines: true,
          };
        }
        // 400: Security is disabled or the security plugin is not installed.
        // ES clusters with xpack.security.enabled=false return a 400 from this
        // endpoint, but the exact error message varies across ES versions (e.g.
        // "no handler found for uri", "security_exception", etc.).  Any 400 here
        // is treated as "security absent" — the user effectively has full access
        // and hiding features would be incorrect.
        if (err.status === 400) {
          return {
            canManageDataStreams: true,
            canCreateApiKeys: true,
            canReadSecurityUsers: true,
            canReadSecurityRoles: true,
            canReadApiKeys: true,
            canReadIngestPipelines: true,
          };
        }
        // 403: Security is enabled but the current user lacks the privilege to
        // query _has_privileges itself.  Default to minimal capabilities so the
        // UI hides features the user probably cannot reach.
        if (err.status === 403) {
          return {
            canManageDataStreams: false,
            canCreateApiKeys: false,
            canReadSecurityUsers: false,
            canReadSecurityRoles: false,
            canReadApiKeys: false,
            canReadIngestPipelines: false,
          };
        }
      }
      // All other errors (401 Unauthorized, 5xx, network failures) are
      // genuine connection/auth problems — surface them to the caller.
      throw err;
    }
  }

  async createApiKey(
    body: { name: string; expiration?: string; metadata?: Record<string, unknown> },
    signal?: AbortSignal,
  ): Promise<CreateApiKeyResponse & { encodedApiKey: string }> {
    const response = await this._fetch<CreateApiKeyResponse>("/_security/api_key", {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
    const encodedApiKey = response.encoded ?? btoa(`${response.id}:${response.api_key}`);
    return { ...response, encodedApiKey };
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
    return executeRawRequest(
      (url, hdrs, opts) => this._doFetch(url, hdrs, opts),
      this.baseUrl,
      this.headers,
      method,
      path,
      body,
      signal,
    );
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

export const DEFAULT_ES_URL = "http://example.com:9200";

export const DEFAULT_CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "content-type": "application/json",
};

const DEFAULT_MOCK_DATA = {
  clusterInfo: {
    cluster_name: "playwright-cluster",
    tagline: "You Know, for Search",
    version: { number: "9.0.0" },
  },
  clusterHealth: {
    cluster_name: "playwright-cluster",
    status: "green",
    timed_out: false,
    number_of_nodes: 3,
    number_of_data_nodes: 2,
    active_primary_shards: 12,
    active_shards: 24,
    initializing_shards: 0,
    relocating_shards: 0,
    delayed_unassigned_shards: 0,
    unassigned_shards: 0,
    number_of_in_flight_fetch: 0,
    active_shards_percent_as_number: 100.0,
  },
  clusterStats: {
    indices: { count: 10, docs: { count: 500_000 }, store: { size_in_bytes: 1_073_741_824 } },
    nodes: { count: { total: 3 } },
  },
  nodesInfo: {
    nodes: { n1: { name: "node-1", roles: ["master", "data_hot"], version: "9.0.0" } },
  },
  nodesStats: {
    nodes: {
      n1: {
        name: "node-1",
        os: {
          cpu: { percent: 25, load_average: { "1m": 0.5, "5m": 0.4, "15m": 0.3 } },
          mem: { used_percent: 72, total_in_bytes: 8_589_934_592, free_in_bytes: 2_404_909_674 },
        },
        jvm: {
          mem: { heap_used_percent: 50 },
          gc: {
            collectors: {
              young: { collection_count: 150, collection_time_in_millis: 3200 },
              old: { collection_count: 2, collection_time_in_millis: 450 },
            },
          },
        },
        fs: {
          total: {
            total_in_bytes: 500_000_000_000,
            available_in_bytes: 300_000_000_000,
          },
        },
        indices: { docs: { count: 500_000 }, shard_stats: { total_count: 12 } },
        thread_pool: {
          write: { active: 2, rejected: 0, completed: 10_000, queue: 0 },
          search: { active: 5, rejected: 0, completed: 50_000, queue: 1 },
          get: { active: 0, rejected: 0, completed: 1_000, queue: 0 },
        },
        breakers: {
          parent: { limit_size_in_bytes: 4_294_967_296, estimated_size_in_bytes: 2_147_483_648, tripped: 0 },
          fielddata: { limit_size_in_bytes: 1_717_986_918, estimated_size_in_bytes: 536_870_912, tripped: 0 },
          request: { limit_size_in_bytes: 2_576_980_377, estimated_size_in_bytes: 0, tripped: 0 },
          in_flight_requests: { limit_size_in_bytes: 4_294_967_296, estimated_size_in_bytes: 0, tripped: 0 },
        },
        process: { open_file_descriptors: 450, max_file_descriptors: 65_536 },
        ingest: { total: { count: 1000, failed: 0, time_in_millis: 5000 } },
      },
    },
  },
  clusterSettings: {
    persistent: {},
    transient: {},
    defaults: {
      "cluster.routing.allocation.disk.watermark.low": "85%",
      "cluster.routing.allocation.disk.watermark.high": "90%",
      "cluster.routing.allocation.disk.watermark.flood_stage": "95%",
      "cluster.routing.allocation.enable": "all",
    },
  },
  pendingTasks: { tasks: [] },
  catShards: [
    { index: "web-logs-2026.02", shard: "0", prirep: "p", state: "STARTED", docs: "125000", store: "262mb", node: "node-1" },
    { index: "web-logs-2026.02", shard: "0", prirep: "r", state: "STARTED", docs: "125000", store: "262mb", node: "node-1" },
  ],
  catAllocation: [
    { node: "node-1", shards: "24", "disk.indices": "500gb", "disk.used": "200gb", "disk.avail": "300gb", "disk.percent": "40" },
  ],
  recovery: {},
  ilmExplain: { indices: {} },
  ilmPolicies: {
    "logs-lifecycle": {
      version: 1,
      modified_date_string: "2026-01-15T00:00:00.000Z",
      policy: {
        phases: {
          hot: { min_age: "0ms", actions: { rollover: { max_primary_shard_size: "50gb" } } },
          warm: { min_age: "30d", actions: { shrink: { number_of_shards: 1 } } },
          delete: { min_age: "90d", actions: { delete: {} } },
        },
      },
      in_use_by: { indices: ["web-logs-2026.02"], data_streams: [], composable_templates: [] },
    },
  },
  ilmExplainDetail: {
    indices: {
      "web-logs-2026.02": {
        index: "web-logs-2026.02",
        managed: true,
        policy: "logs-lifecycle",
        phase: "hot",
        action: "complete",
        step: "complete",
        age: "5d",
        lifecycle_date_millis: Date.now() - 5 * 86_400_000,
      },
    },
  },
  tasks: {
    tasks: [
      {
        node: "n1",
        id: 101,
        type: "transport",
        action: "indices:data/read/search",
        description: "searching web-logs-*",
        start_time_in_millis: Date.now() - 5000,
        running_time_in_nanos: 5_000_000_000,
        cancellable: true,
      },
      {
        node: "n1",
        id: 102,
        type: "transport",
        action: "cluster:monitor/tasks/lists",
        description: "",
        start_time_in_millis: Date.now() - 100,
        running_time_in_nanos: 100_000_000,
        cancellable: false,
      },
    ],
  },
  cancelTask: { node_failures: [], task_failures: [], nodes: {} },
  indexTemplates: {
    index_templates: [
      {
        name: "logs-nginx",
        index_template: {
          index_patterns: ["logs-nginx*"],
          composed_of: ["logs-mappings", "logs-settings"],
          priority: 200,
          version: 1,
          data_stream: {},
        },
      },
    ],
  },
  componentTemplates: {
    component_templates: [
      {
        name: "logs-mappings",
        component_template: {
          template: { mappings: { properties: { "@timestamp": { type: "date" } } } },
          version: 1,
        },
      },
      {
        name: "logs-settings",
        component_template: {
          template: { settings: { number_of_replicas: 1 } },
          version: 1,
        },
      },
    ],
  },
  allocationExplain: { error: { reason: "unable to find any unassigned shards to explain" } },
  allocationExplainStatus: 400,
  slmStats: { operation_mode: "RUNNING", policy_stats: [] },
  snapshotStatus: { snapshots: [] },
  ingestNodeStats: { nodes: { n1: { ingest: { total: { count: 1000, failed: 0 } } } } },
  hasPrivileges: {
    cluster: {
      manage: true,
      read_security: true,
      manage_security: false,
      manage_own_api_key: true,
      manage_api_key: false,
    },
  },
  securityUsers: {
    elastic: {
      username: "elastic",
      enabled: true,
      roles: ["superuser"],
      full_name: "Built-in Superuser",
    },
  },
  securityRoles: {
    superuser: { cluster: ["all"], indices: [{ names: ["*"], privileges: ["all"] }] },
  },
  apiKeys: {
    api_keys: [
      {
        id: "mock-key-1",
        name: "ingest-pipeline-key",
        username: "elastic",
        creation: Date.now() - 30 * 86_400_000,
        expiration: Date.now() + 30 * 86_400_000,
        invalidated: false,
        metadata: {},
      },
      {
        id: "mock-key-2",
        name: "never-expiring-key",
        username: "elastic",
        creation: Date.now() - 120 * 86_400_000,
        expiration: null,
        invalidated: false,
        metadata: { purpose: "legacy integration" },
      },
    ],
  },
  catIndices: [
    {
      index: "web-logs-2026.02",
      health: "green",
      status: "open",
      pri: "1",
      rep: "1",
      "docs.count": "125000",
      "docs.deleted": "0",
      "store.size": "524288000",
      "pri.store.size": "262144000",
    },
  ],
  dataStreams: {
    data_streams: [
      {
        name: "logs-nginx.access-default",
        timestamp_field: { name: "@timestamp" },
        indices: [],
        generation: 1,
        status: "GREEN",
        template: "logs-nginx",
      },
    ],
  },
  resolveIndex: { indices: [], aliases: [], data_streams: [] },
  fieldCaps: {
    fields: { "@timestamp": { date: { type: "date", searchable: true, aggregatable: true } } },
  },
  indexMapping: {},
  indexSettings: {},
  indexStats: {
    _shards: { total: 2, successful: 2, failed: 0 },
    _all: {
      primaries: { docs: { count: 125000, deleted: 0 }, store: { size_in_bytes: 262144000 } },
      total: { docs: { count: 125000, deleted: 0 }, store: { size_in_bytes: 524288000 } },
    },
  },
  ingestPipelines: {
    "logs-parse-nginx": { description: "Parse NGINX access logs", processors: [] },
  },
  esqlLimit0: {
    columns: [
      { name: "@timestamp", type: "date" },
      { name: "system.cpu.total.norm.pct", type: "double" },
      { name: "host.name", type: "keyword" },
    ],
    values: [],
  },
  esqlMetrics: {
    columns: [
      { name: "timestamp", type: "date" },
      { name: "metric", type: "double" },
    ],
    values: [
      ["2026-02-26T10:00:00.000Z", 0.12],
      ["2026-02-26T10:05:00.000Z", 0.32],
      ["2026-02-26T10:10:00.000Z", 0.24],
    ],
  },
  esqlDefault: {
    columns: [
      { name: "@timestamp", type: "date" },
      { name: "message", type: "text" },
    ],
    values: [["2026-02-26T10:00:00.000Z", "Hello World"]],
  },
};

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, override) {
  if (!isObject(base) || !isObject(override)) return override ?? base;
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (isObject(value) && isObject(merged[key])) merged[key] = deepMerge(merged[key], value);
    else merged[key] = value;
  }
  return merged;
}

function withDefaults(overrides = {}) {
  return deepMerge(DEFAULT_MOCK_DATA, overrides);
}

export async function registerElasticsearchMocks(
  page,
  {
    esUrl = DEFAULT_ES_URL,
    corsHeaders = DEFAULT_CORS_HEADERS,
    data = {},
    queryResolver,
    fallback = {},
    fallbackStatus = 404,
  } = {},
) {
  const resolved = withDefaults(data);
  await page.route(`${esUrl}/**`, async (route) => {
    const req = route.request();
    const method = req.method();
    const path = new URL(req.url()).pathname;

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
      return;
    }

    const json = (body, status = 200) =>
      route.fulfill({ status, headers: corsHeaders, body: JSON.stringify(body) });

    if (path === "/" && method === "GET") return json(resolved.clusterInfo);
    if (path === "/_cluster/health") return json(resolved.clusterHealth);
    if (path === "/_cluster/stats") return json(resolved.clusterStats);
    if (path === "/_nodes" && method === "GET") return json(resolved.nodesInfo);
    if (path.startsWith("/_nodes/stats")) return json(resolved.nodesStats);

    if (path === "/_security/user/_has_privileges") return json(resolved.hasPrivileges);
    if (path === "/_security/user" && method === "GET") return json(resolved.securityUsers);
    if (path === "/_security/role" && method === "GET") return json(resolved.securityRoles);
    if (path === "/_security/api_key" && method === "GET") return json(resolved.apiKeys);

    if (path === "/_cluster/settings" && method === "GET") return json(resolved.clusterSettings);
    if (path === "/_cluster/pending_tasks" && method === "GET") return json(resolved.pendingTasks);
    if (path === "/_cluster/allocation/explain" && method === "POST") {
      const status =
        resolved.allocationExplainStatus ??
        (resolved.allocationExplain?.error != null ? 400 : 200);
      return json(resolved.allocationExplain, status);
    }
    if (path === "/_cat/shards" && method === "GET") return json(resolved.catShards);
    if (path === "/_cat/allocation" && method === "GET") return json(resolved.catAllocation);
    if (path.startsWith("/_recovery") && method === "GET") return json(resolved.recovery);
    if (path === "/_ilm/policy" && method === "GET") return json(resolved.ilmPolicies);
    if (path.match(/\/_ilm\/explain/) && method === "GET") return json(resolved.ilmExplainDetail);
    if (path === "/_tasks" && method === "GET") return json(resolved.tasks);
    if (path.match(/^\/_tasks\/[^/]+\/_cancel$/) && method === "POST") return json(resolved.cancelTask);
    if (path === "/_index_template" && method === "GET") return json(resolved.indexTemplates);
    if (path === "/_component_template" && method === "GET") return json(resolved.componentTemplates);
    if (path === "/_slm/stats" && method === "GET") return json(resolved.slmStats);
    if (path.startsWith("/_snapshot/") && method === "GET") return json(resolved.snapshotStatus);
    if (path === "/_cat/indices" && method === "GET") return json(resolved.catIndices);
    if (path === "/_data_stream" && method === "GET") return json(resolved.dataStreams);
    if (path.startsWith("/_resolve/index/") && method === "GET") return json(resolved.resolveIndex);
    if (path.match(/\/_field_caps/) && method === "GET") return json(resolved.fieldCaps);
    if (path.match(/^\/[^_][^/]*\/_mapping$/) && method === "GET") return json(resolved.indexMapping);
    if (path.match(/^\/[^_][^/]*\/_settings$/) && method === "GET")
      return json(resolved.indexSettings);
    if (path.match(/^\/[^_][^/]*\/_stats$/) && method === "GET") return json(resolved.indexStats);

    if (path === "/_ingest/pipeline" && method === "GET") return json(resolved.ingestPipelines);
    if (path.startsWith("/_fleet/")) return json({});

    if (path === "/_query" && method === "POST") {
      const payload = req.postDataJSON();
      const query = payload?.query ?? "";
      if (typeof queryResolver === "function") {
        const queryResult = await queryResolver({ query, request: req });
        if (queryResult !== undefined) return json(queryResult);
      }
      if (query.includes("LIMIT 0")) return json(resolved.esqlLimit0);
      if (query.includes("FROM metrics-*")) return json(resolved.esqlMetrics);
      return json(resolved.esqlDefault);
    }

    // Catch-all for _search POST requests on unknown indices.
    // Mimics Elasticsearch behaviour with ignore_unavailable=true&allow_no_indices=true.
    if (
      method === "POST" &&
      (path === "/_search" || /^\/[^/]+\/_search$/.test(path))
    ) {
      return json({ hits: { total: { value: 0, relation: "eq" }, hits: [] } });
    }

    return json(fallback, fallbackStatus);
  });
}

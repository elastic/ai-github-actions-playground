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
    status: "green",
    number_of_nodes: 3,
    active_primary_shards: 12,
    active_shards: 24,
    unassigned_shards: 0,
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
        os: { cpu: { percent: 25 } },
        jvm: { mem: { heap_used_percent: 50 } },
        fs: {
          total: {
            total_in_bytes: 500_000_000_000,
            available_in_bytes: 300_000_000_000,
          },
        },
        indices: { docs: { count: 500_000 }, shard_stats: { total_count: 12 } },
      },
    },
  },
  hasPrivileges: {
    cluster: { manage_data_stream: true, read_security: true, manage_security: false },
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
    if (path === "/_nodes/stats") return json(resolved.nodesStats);

    if (path === "/_security/user/_has_privileges") return json(resolved.hasPrivileges);
    if (path === "/_security/user" && method === "GET") return json(resolved.securityUsers);
    if (path === "/_security/role" && method === "GET") return json(resolved.securityRoles);

    if (path === "/_cat/indices") return json(resolved.catIndices);
    if (path === "/_data_stream") return json(resolved.dataStreams);
    if (path.startsWith("/_resolve/index/")) return json(resolved.resolveIndex);
    if (path.match(/\/_field_caps/)) return json(resolved.fieldCaps);
    if (path.match(/^\/[^_][^/]*\/_mapping$/)) return json(resolved.indexMapping);
    if (path.match(/^\/[^_][^/]*\/_settings$/)) return json(resolved.indexSettings);
    if (path.match(/^\/[^_][^/]*\/_stats$/)) return json(resolved.indexStats);

    if (path === "/_ingest/pipeline") return json(resolved.ingestPipelines);
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

    return json(fallback);
  });
}

/**
 * Love Audit — Playwright spec that navigates every major page with rich
 * mocked Elasticsearch data, takes screenshots, runs accessibility checks,
 * and captures console diagnostics.
 *
 * The companion GitHub Actions workflow (`give-it-some-love.yml`) runs this
 * spec, then an AI agent reads the screenshots + output to identify paper
 * cuts and file a GitHub issue.
 */
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import { DEFAULT_ES_URL, registerElasticsearchMocks } from "../../scripts/elasticsearch-mocks.mjs";

import { COMMON_PAGES, registerLoveAuditTests } from "./fixtures/love-audit-helpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const CLUSTER_INFO = {
  cluster_name: "love-audit-cluster",
  cluster_uuid: "abc-123",
  version: { number: "9.0.0", build_flavor: "default" },
  tagline: "You Know, for Search",
};

const CLUSTER_HEALTH = {
  status: "yellow",
  number_of_nodes: 3,
  number_of_data_nodes: 2,
  active_primary_shards: 12,
  active_shards: 24,
  unassigned_shards: 2,
};

const CLUSTER_STATS = {
  indices: {
    count: 42,
    shards: { total: 84 },
    docs: { count: 1_250_000 },
    store: { size_in_bytes: 2_147_483_648 },
  },
  nodes: { count: { total: 3 } },
};

const NODES_INFO = {
  nodes: {
    node1: { name: "node-hot-1", roles: ["master", "data_hot"], version: "9.0.0" },
    node2: { name: "node-warm-1", roles: ["data_warm"], version: "9.0.0" },
    node3: { name: "node-cold-1", roles: ["data_cold"], version: "9.0.0" },
  },
};

const NODES_STATS = {
  nodes: {
    node1: {
      name: "node-hot-1",
      os: { cpu: { percent: 42 } },
      jvm: { mem: { heap_used_percent: 65 } },
      fs: { total: { total_in_bytes: 500_000_000_000, available_in_bytes: 250_000_000_000 } },
      indices: { docs: { count: 800_000 }, shard_stats: { total_count: 30 } },
    },
    node2: {
      name: "node-warm-1",
      os: { cpu: { percent: 18 } },
      jvm: { mem: { heap_used_percent: 40 } },
      fs: { total: { total_in_bytes: 1_000_000_000_000, available_in_bytes: 700_000_000_000 } },
      indices: { docs: { count: 350_000 }, shard_stats: { total_count: 20 } },
    },
    node3: {
      name: "node-cold-1",
      os: { cpu: { percent: 5 } },
      jvm: { mem: { heap_used_percent: 22 } },
      fs: { total: { total_in_bytes: 2_000_000_000_000, available_in_bytes: 1_800_000_000_000 } },
      indices: { docs: { count: 100_000 }, shard_stats: { total_count: 10 } },
    },
  },
};

const CAT_INDICES = [
  {
    index: "web-logs-2026.02",
    health: "green",
    status: "open",
    pri: "1",
    rep: "1",
    "docs.count": "125000",
    "docs.deleted": "340",
    "store.size": "524288000",
    "pri.store.size": "262144000",
  },
  {
    index: "metrics-system-2026.02",
    health: "green",
    status: "open",
    pri: "2",
    rep: "1",
    "docs.count": "890000",
    "docs.deleted": "120",
    "store.size": "1073741824",
    "pri.store.size": "536870912",
  },
  {
    index: ".internal-alerts",
    health: "yellow",
    status: "open",
    pri: "1",
    rep: "1",
    "docs.count": "42",
    "docs.deleted": "0",
    "store.size": "65536",
    "pri.store.size": "32768",
  },
];

const INDEX_MAPPING = {
  "web-logs-2026.02": {
    mappings: {
      properties: {
        "@timestamp": { type: "date" },
        message: { type: "text" },
        "host.name": { type: "keyword" },
        "http.request.method": { type: "keyword" },
        "http.response.status_code": { type: "integer" },
        "url.path": { type: "keyword" },
        "source.ip": { type: "ip" },
        "event.duration": { type: "long" },
      },
    },
  },
};

const INDEX_SETTINGS = {
  "web-logs-2026.02": {
    settings: {
      index: {
        number_of_shards: "1",
        number_of_replicas: "1",
        creation_date: "1740000000000",
        provided_name: "web-logs-2026.02",
        uuid: "xyz-789",
      },
    },
  },
};

const INDEX_STATS = {
  _shards: { total: 2, successful: 2, failed: 0 },
  _all: {
    primaries: {
      docs: { count: 125000, deleted: 340 },
      store: { size_in_bytes: 262144000 },
      indexing: { index_total: 126000, index_time_in_millis: 45000 },
      search: { query_total: 8900, query_time_in_millis: 12000 },
      segments: { count: 14, memory_in_bytes: 1048576 },
    },
    total: {
      docs: { count: 250000, deleted: 680 },
      store: { size_in_bytes: 524288000 },
      indexing: { index_total: 252000, index_time_in_millis: 90000 },
      search: { query_total: 17800, query_time_in_millis: 24000 },
      segments: { count: 28, memory_in_bytes: 2097152 },
      get: { total: 150 },
      merge: { total: 8 },
      refresh: { total: 320, total_time_in_millis: 5000 },
      flush: { total: 12, total_time_in_millis: 800 },
    },
  },
};

const DATA_STREAMS = {
  data_streams: [
    {
      name: "logs-nginx.access-default",
      timestamp_field: { name: "@timestamp" },
      indices: [
        { index_name: ".ds-logs-nginx.access-default-2026.02.01-000001", index_uuid: "a1" },
        { index_name: ".ds-logs-nginx.access-default-2026.02.15-000002", index_uuid: "a2" },
      ],
      generation: 2,
      status: "GREEN",
      template: "logs-nginx.access",
    },
    {
      name: "metrics-system.cpu-default",
      timestamp_field: { name: "@timestamp" },
      indices: [
        { index_name: ".ds-metrics-system.cpu-default-2026.02.01-000001", index_uuid: "b1" },
      ],
      generation: 1,
      status: "GREEN",
      template: "metrics-system.cpu",
    },
  ],
};

const RESOLVE_INDEX = {
  indices: [
    { name: "web-logs-2026.02", attributes: ["open"] },
    { name: "metrics-system-2026.02", attributes: ["open"] },
  ],
  aliases: [],
  data_streams: [
    {
      name: "logs-nginx.access-default",
      backing_indices: [".ds-logs-nginx.access-default-2026.02.01-000001"],
      timestamp_field: "@timestamp",
    },
  ],
};

const INGEST_PIPELINES = {
  "logs-parse-nginx": {
    description: "Parse NGINX access logs into structured fields",
    version: 3,
    processors: [
      { grok: { field: "message", patterns: ["%{COMBINEDAPACHELOG}"] } },
      { date: { field: "timestamp", formats: ["dd/MMM/yyyy:HH:mm:ss Z"] } },
      { remove: { field: "message" } },
    ],
  },
  "enrich-geoip": {
    description: "Add GeoIP data from source.ip",
    processors: [{ geoip: { field: "source.ip" } }],
  },
  "metrics-normalize": {
    processors: [
      { set: { field: "event.kind", value: "metric" } },
      { rename: { field: "system.cpu.total.pct", target_field: "system.cpu.total.norm.pct" } },
    ],
  },
};

const HAS_PRIVILEGES = {
  cluster: {
    manage_data_stream: true,
    read_security: true,
    manage_security: false,
    manage_own_api_key: true,
    manage_api_key: false,
  },
};

const SECURITY_USERS = {
  elastic: {
    username: "elastic",
    enabled: true,
    roles: ["superuser"],
    full_name: "Built-in Superuser",
  },
  kibana_system: {
    username: "kibana_system",
    enabled: true,
    roles: ["kibana_system"],
    full_name: null,
  },
  readonly_user: {
    username: "readonly_user",
    enabled: true,
    roles: ["viewer"],
    full_name: "Read Only",
  },
};

const SECURITY_ROLES = {
  superuser: { cluster: ["all"], indices: [{ names: ["*"], privileges: ["all"] }], run_as: ["*"] },
  viewer: { cluster: ["monitor"], indices: [{ names: ["*"], privileges: ["read"] }], run_as: [] },
};

const ESQL_QUERY_LAB = {
  columns: [
    { name: "@timestamp", type: "date" },
    { name: "host.name", type: "keyword" },
    { name: "http.request.method", type: "keyword" },
    { name: "http.response.status_code", type: "integer" },
    { name: "url.path", type: "keyword" },
    { name: "event.duration", type: "long" },
  ],
  values: [
    ["2026-02-26T10:00:00.000Z", "web-01", "GET", 200, "/api/health", 1200],
    ["2026-02-26T10:00:01.000Z", "web-02", "POST", 201, "/api/orders", 4500],
    ["2026-02-26T10:00:02.000Z", "web-01", "GET", 404, "/api/missing", 800],
    ["2026-02-26T10:00:03.000Z", "web-03", "DELETE", 204, "/api/cache", 350],
    ["2026-02-26T10:00:04.000Z", "web-01", "GET", 500, "/api/payments", 15200],
    ["2026-02-26T10:00:05.000Z", "web-02", "PUT", 200, "/api/users/42", 2100],
    ["2026-02-26T10:00:06.000Z", "web-03", "GET", 200, "/api/products", 980],
    ["2026-02-26T10:00:07.000Z", "web-01", "POST", 400, "/api/orders", 600],
    ["2026-02-26T10:00:08.000Z", "web-02", "GET", 200, "/api/health", 450],
    ["2026-02-26T10:00:09.000Z", "web-03", "GET", 302, "/old-page", 120],
  ],
};

const METRICS_COLUMNS = {
  columns: [
    { name: "@timestamp", type: "date" },
    { name: "system.cpu.total.norm.pct", type: "double" },
    { name: "host.name", type: "keyword" },
  ],
  values: [],
};

const METRICS_DATA = {
  columns: [
    { name: "timestamp", type: "date" },
    { name: "metric", type: "double" },
  ],
  values: [
    ["2026-02-26T10:00:00.000Z", 0.12],
    ["2026-02-26T10:05:00.000Z", 0.32],
    ["2026-02-26T10:10:00.000Z", 0.24],
    ["2026-02-26T10:15:00.000Z", 0.55],
    ["2026-02-26T10:20:00.000Z", 0.41],
  ],
};

const FIELD_CAPS = {
  fields: {
    "@timestamp": { date: { type: "date", searchable: true, aggregatable: true } },
    "host.name": { keyword: { type: "keyword", searchable: true, aggregatable: true } },
    message: { text: { type: "text", searchable: true, aggregatable: false } },
  },
};

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

async function mockElasticsearch(page: Page) {
  await registerElasticsearchMocks(page, {
    esUrl: DEFAULT_ES_URL,
    data: {
      clusterInfo: CLUSTER_INFO,
      clusterHealth: CLUSTER_HEALTH,
      clusterStats: CLUSTER_STATS,
      nodesInfo: NODES_INFO,
      nodesStats: NODES_STATS,
      hasPrivileges: HAS_PRIVILEGES,
      securityUsers: SECURITY_USERS,
      securityRoles: SECURITY_ROLES,
      catIndices: CAT_INDICES,
      indexMapping: INDEX_MAPPING,
      indexSettings: INDEX_SETTINGS,
      indexStats: INDEX_STATS,
      dataStreams: DATA_STREAMS,
      resolveIndex: RESOLVE_INDEX,
      fieldCaps: FIELD_CAPS,
      ingestPipelines: INGEST_PIPELINES,
      esqlLimit0: METRICS_COLUMNS,
      esqlMetrics: METRICS_DATA,
      esqlDefault: ESQL_QUERY_LAB,
    },
    fallback: {},
  });
}

async function connectToMockedCluster(page: Page) {
  await mockElasticsearch(page);
  await page.goto("");
  await page.getByRole("button", { name: "Connect to Elasticsearch" }).click();
  await page.getByRole("textbox", { name: "Elasticsearch URL" }).fill(DEFAULT_ES_URL);
  await page.getByRole("button", { name: "Connect", exact: true }).click();

  // On mobile the sidebar is behind a drawer; verify connection via the menu toggle
  const viewport = page.viewportSize();
  const isMobile = viewport != null && viewport.width < 768;
  if (isMobile) {
    await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "Metrics", exact: true })).toBeVisible();
  }
}

// ---------------------------------------------------------------------------
// Register tests
// ---------------------------------------------------------------------------

registerLoveAuditTests(
  "love audit — page-by-page quality check",
  connectToMockedCluster,
  COMMON_PAGES,
  "love-audit",
);

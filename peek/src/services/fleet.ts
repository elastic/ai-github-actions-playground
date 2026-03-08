import { type ElasticsearchClient } from "./es";
import { extractHits, extractTotal, gracefulSearch } from "./es/searchHelpers";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function readNestedString(
  source: Record<string, unknown>,
  path: string[],
  fallback = "unknown",
): string {
  let current: unknown = source;
  for (const key of path) {
    if (typeof current !== "object" || current === null || !(key in current)) {
      return fallback;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" && current.length > 0 ? current : fallback;
}

export function readNestedNumber(source: Record<string, unknown>, path: string[]): number | null {
  let current: unknown = source;
  for (const key of path) {
    if (typeof current !== "object" || current === null || !(key in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "number" ? current : null;
}

function readNested(source: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (typeof current !== "object" || current === null || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function parseFleetSchema<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const parsed = schema.safeParse(data);
  if (parsed.success) {
    return parsed.data;
  }
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Unexpected ${label} response shape: ${issues.join("; ")}`);
}

const fleetAgentsUnhealthyReasonSchema = z
  .object({
    input: z.number().optional().default(0),
    output: z.number().optional().default(0),
    other: z.number().optional().default(0),
  })
  .passthrough();

const fleetAgentsStatusSchema = z
  .object({
    total: z.number().optional().default(0),
    healthy: z.number().optional().default(0),
    unhealthy: z.number().optional().default(0),
    offline: z.number().optional().default(0),
    updating: z.number().optional().default(0),
    inactive: z.number().optional().default(0),
    enrolled: z.number().optional().default(0),
    unenrolled: z.number().optional().default(0),
    unhealthy_reason: fleetAgentsUnhealthyReasonSchema
      .optional()
      .default({ input: 0, output: 0, other: 0 }),
  })
  .passthrough();

const fleetOutputAggregationsSchema = z.object({
  buckets: z
    .array(
      z.object({
        key: z.string(),
        latest: z.object({
          hits: z.object({
            hits: z.array(
              z.object({
                _source: z.record(z.string(), z.unknown()).optional(),
              }),
            ),
          }),
        }),
      }),
    )
    .optional(),
});

const fleetOutputSourceSchema = z
  .object({
    output: z.string().optional(),
    state: z.string().optional(),
    message: z.string().optional(),
    "@timestamp": z.string().optional(),
  })
  .passthrough();

const inventoryAggregationsSchema = z.object({
  agent_count: z.object({ value: z.number().optional() }).optional(),
  error_agents: z
    .object({ count: z.object({ value: z.number().optional() }).optional() })
    .optional(),
  agents: z
    .object({
      buckets: z
        .array(
          z.object({
            key: z.string(),
            doc_count: z.number(),
            latest: z.object({
              hits: z.object({
                hits: z.array(z.object({ _source: z.record(z.string(), z.unknown()).optional() })),
              }),
            }),
            errors: z.object({ doc_count: z.number() }),
          }),
        )
        .optional(),
    })
    .optional(),
});

const actionSourceSchema = z
  .object({
    action_id: z.string().optional(),
    type: z.string().optional(),
    agents: z.array(z.string()).optional(),
    expiration: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    "@timestamp": z.string().optional(),
  })
  .passthrough();

const actionResultSourceSchema = z
  .object({
    action_id: z.string().optional(),
    agent_id: z.string().optional(),
    error: z.string().optional(),
    completed_at: z.string().optional(),
  })
  .passthrough();

const agentLogSourceSchema = z
  .object({
    "@timestamp": z.string().optional(),
    log: z.object({ level: z.string().optional() }).optional(),
    agent: z.object({ id: z.string().optional() }).optional(),
    message: z.string().optional(),
    component: z.string().optional(),
  })
  .passthrough();

const agentMetricSourceSchema = z
  .object({
    "@timestamp": z.string().optional(),
    system: z
      .object({
        process: z
          .object({
            cpu: z
              .object({ total: z.object({ value: z.number().optional() }).optional() })
              .optional(),
            memory: z.object({ size: z.number().optional() }).optional(),
            fd: z.object({ open: z.number().optional() }).optional(),
          })
          .optional(),
      })
      .optional(),
    beat: z
      .object({
        stats: z
          .object({
            libbeat: z
              .object({
                output: z
                  .object({ events: z.object({ total: z.number().optional() }).optional() })
                  .optional(),
              })
              .optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Fleet Agent types (from fleet-agents* simulator index)
// ---------------------------------------------------------------------------

export interface FleetAgentSummary {
  id: string;
  hostname: string;
  status: string;
  policyId: string;
  policyRevision: number | null;
  active: boolean | null;
  lastCheckin: string | null;
  source: Record<string, unknown>;
}

export interface FleetAgentSearchResult {
  agents: FleetAgentSummary[];
  total: number;
}

export interface FleetPolicySummary {
  policyId: string;
  agents: number;
  healthyAgents: number;
  degradedAgents: number;
  errorAgents: number;
  inactiveAgents: number;
}

// ---------------------------------------------------------------------------
// Fleet Server public metrics types
// ---------------------------------------------------------------------------

export interface FleetServerStatusMetrics {
  total: number;
  healthy: number;
  unhealthy: number;
  offline: number;
  updating: number;
  inactive: number;
  enrolled: number;
  unenrolled: number;
  unhealthyReason: { input: number; output: number; other: number };
  timestamp: string;
}

export interface FleetAgentVersionCount {
  version: string;
  count: number;
}

export interface FleetOutputHealth {
  output: string;
  state: string;
  message: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Elastic Agent telemetry types (public data streams)
// ---------------------------------------------------------------------------

export interface ElasticAgentInfo {
  agentId: string;
  hostname: string;
  version: string;
  os: { name: string; platform: string; version: string; full: string } | null;
  lastSeen: string;
  logCount: number;
  errorCount: number;
  status: string;
  policyId: string;
}

export interface ElasticAgentLogEntry {
  timestamp: string;
  level: string;
  message: string;
  component: string;
  agentId: string;
}

export interface ElasticAgentMetricPoint {
  timestamp: string;
  cpuPct: number | null;
  memoryPct: number | null;
  handles: number | null;
  eventsRate: number | null;
}

// ---------------------------------------------------------------------------
// Fleet Action types (from simulator indices)
// ---------------------------------------------------------------------------

export interface FleetAction {
  id: string;
  type: string;
  agents: string[];
  createdAt: string;
  expiration: string | null;
  data: Record<string, unknown>;
}

export interface FleetActionResult {
  actionId: string;
  agentId: string;
  error: string | null;
  completedAt: string;
}

// ---------------------------------------------------------------------------
// Status color helper
// ---------------------------------------------------------------------------

export function fleetStatusColor(
  status: string,
): "default" | "primary" | "secondary" | "success" | "warning" | "error" {
  const normalized = status.toLowerCase().trim();
  if (normalized === "online" || normalized === "healthy") return "success";
  if (normalized === "error") return "error";
  if (normalized === "degraded" || normalized === "warning" || normalized === "unhealthy")
    return "warning";
  if (normalized === "updating" || normalized === "upgrading") return "primary";
  return "default";
}

// ---------------------------------------------------------------------------
// Checkin staleness helper
// ---------------------------------------------------------------------------

export function computeCheckinStaleness(lastSeen: string | null): {
  label: string;
  severity: "fresh" | "stale" | "critical";
} {
  if (!lastSeen) return { label: "unknown", severity: "critical" };
  const diffMs = Math.max(0, Date.now() - Date.parse(lastSeen));
  if (Number.isNaN(diffMs)) return { label: "unknown", severity: "critical" };
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) {
    return { label: `${seconds}s ago`, severity: "fresh" };
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return { label: `${minutes}m ago`, severity: minutes < 5 ? "fresh" : "stale" };
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return { label: `${hours}h ago`, severity: hours < 2 ? "stale" : "critical" };
  }
  const days = Math.floor(hours / 24);
  return { label: `${days}d ago`, severity: "critical" };
}

// ---------------------------------------------------------------------------
// Derive agent status from checkin staleness
// ---------------------------------------------------------------------------

export type DerivedAgentStatus = "Healthy" | "Unhealthy" | "Offline";

export function deriveAgentStatus(lastSeen: string | null): DerivedAgentStatus {
  const { severity } = computeCheckinStaleness(lastSeen);
  switch (severity) {
    case "fresh":
      return "Healthy";
    case "stale":
      return "Unhealthy";
    case "critical":
      return "Offline";
    default: {
      const exhaustiveCheck: never = severity;
      return exhaustiveCheck;
    }
  }
}

// ---------------------------------------------------------------------------
// Fleet Agent aggregation (kept for simulator / fallback)
// ---------------------------------------------------------------------------

export function aggregateFleetPolicies(agents: FleetAgentSummary[]): FleetPolicySummary[] {
  const policies = new Map<string, FleetPolicySummary>();
  for (const agent of agents) {
    const policyId = agent.policyId || "unknown";
    const current = policies.get(policyId) ?? {
      policyId,
      agents: 0,
      healthyAgents: 0,
      degradedAgents: 0,
      errorAgents: 0,
      inactiveAgents: 0,
    };
    current.agents += 1;
    const status = agent.status.trim().toLowerCase();
    if (status === "healthy" || status === "online") current.healthyAgents += 1;
    if (status === "degraded" || status === "warning") current.degradedAgents += 1;
    if (status === "error") current.errorAgents += 1;
    if (agent.active === false) current.inactiveAgents += 1;
    policies.set(policyId, current);
  }
  return [...policies.values()].sort((a, b) => b.agents - a.agents);
}

// ---------------------------------------------------------------------------
// Load Fleet agents from fleet-agents* (public sim index)
// ---------------------------------------------------------------------------

export async function loadFleetAgents(
  client: ElasticsearchClient,
): Promise<FleetAgentSearchResult> {
  const data = await gracefulSearch(client, "fleet-agents*", {
    size: 500,
    track_total_hits: true,
    sort: [{ last_checkin: { order: "desc", unmapped_type: "date" } }],
    _source: [
      "agent.id",
      "active",
      "policy_id",
      "policy_revision_idx",
      "last_checkin_status",
      "last_checkin",
      "enrolled_at",
      "local_metadata.host.hostname",
      "local_metadata.os",
      "local_metadata.elastic.agent",
    ],
    query: { match_all: {} },
  });
  if (!data) return { total: 0, agents: [] };
  const hits = extractHits(data);
  return {
    total: extractTotal(data),
    agents: hits.map((hit) => {
      const source = hit._source;
      return {
        id: readNestedString(source, ["agent", "id"], hit._id ?? "unknown"),
        hostname: readNestedString(source, ["local_metadata", "host", "hostname"]),
        status: readNestedString(source, ["last_checkin_status"]),
        policyId: readNestedString(source, ["policy_id"]),
        policyRevision: readNestedNumber(source, ["policy_revision_idx"]),
        active: typeof source.active === "boolean" ? source.active : null,
        lastCheckin: typeof source.last_checkin === "string" ? source.last_checkin : null,
        source,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Fleet Server status metrics (from metrics-fleet_server.agent_status-default)
// ---------------------------------------------------------------------------

export async function loadFleetServerStatus(
  client: ElasticsearchClient,
): Promise<FleetServerStatusMetrics | null> {
  const data = await gracefulSearch(client, "metrics-fleet_server.agent_status-*", {
    size: 1,
    sort: [{ "@timestamp": { order: "desc" } }],
    _source: ["fleet.agents", "@timestamp"],
    query: { match_all: {} },
  });
  const hits = extractHits(data);
  if (hits.length === 0) return null;
  const source = hits[0]!._source;
  const nestedAgents = readNested(source, ["fleet", "agents"]);
  if (!nestedAgents) return null;
  const agents = parseFleetSchema(fleetAgentsStatusSchema, nestedAgents, "Fleet server status");
  const reasons = agents.unhealthy_reason;
  return {
    total: agents.total,
    healthy: agents.healthy,
    unhealthy: agents.unhealthy,
    offline: agents.offline,
    updating: agents.updating,
    inactive: agents.inactive,
    enrolled: agents.enrolled,
    unenrolled: agents.unenrolled,
    unhealthyReason: {
      input: reasons.input,
      output: reasons.output,
      other: reasons.other,
    },
    timestamp: readNestedString(source, ["@timestamp"], ""),
  };
}

// ---------------------------------------------------------------------------
// Fleet agent version distribution (from metrics-fleet_server.agent_versions-*)
// ---------------------------------------------------------------------------

export async function loadFleetAgentVersions(
  client: ElasticsearchClient,
): Promise<FleetAgentVersionCount[]> {
  const data = await gracefulSearch(client, "metrics-fleet_server.agent_versions-*", {
    size: 100,
    sort: [{ "@timestamp": { order: "desc" } }],
    _source: ["fleet.agent.version", "fleet.agent.count"],
    query: { match_all: {} },
  });
  const hits = extractHits(data);
  if (hits.length === 0) return [];
  // Each doc is one version; deduplicate by taking the most recent per version
  const versionMap = new Map<string, number>();
  for (const hit of hits) {
    const version = readNestedString(hit._source, ["fleet", "agent", "version"], "");
    const count = readNestedNumber(hit._source, ["fleet", "agent", "count"]);
    if (version && count !== null && !versionMap.has(version)) {
      versionMap.set(version, count);
    }
  }
  return [...versionMap.entries()]
    .map(([version, count]) => ({ version, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Fleet output health (from logs-fleet_server.output_health-*)
// ---------------------------------------------------------------------------

export async function loadFleetOutputHealth(
  client: ElasticsearchClient,
): Promise<FleetOutputHealth[]> {
  // Use a terms aggregation to get the latest state per output
  const data = await gracefulSearch(client, "logs-fleet_server.output_health-*", {
    size: 0,
    aggs: {
      by_output: {
        terms: { field: "output", size: 50 },
        aggs: {
          latest: {
            top_hits: {
              size: 1,
              sort: [{ "@timestamp": { order: "desc" } }],
              _source: ["output", "state", "message", "@timestamp"],
            },
          },
        },
      },
    },
    query: { match_all: {} },
  });
  if (!data?.aggregations) return [];
  const byOutput = parseFleetSchema(
    fleetOutputAggregationsSchema,
    data.aggregations.by_output,
    "Fleet output health aggregation",
  );
  if (!byOutput?.buckets) return [];
  return byOutput.buckets.map((bucket) => {
    const source = parseFleetSchema(
      fleetOutputSourceSchema,
      bucket.latest.hits.hits[0]?._source ?? {},
      "Fleet output health document",
    );
    return {
      output: source.output ?? bucket.key,
      state: source.state ?? "UNKNOWN",
      message: source.message ?? "",
      timestamp: source["@timestamp"] ?? "",
    };
  });
}

// ---------------------------------------------------------------------------
// Elastic Agent inventory (from logs-elastic_agent-*)
// Uses a composite/terms aggregation on agent.id with top_hits for metadata
// ---------------------------------------------------------------------------

export interface ElasticAgentInventoryResult {
  agents: ElasticAgentInfo[];
  total: number;
  errorAgentTotal: number;
}

export async function loadElasticAgentInventory(
  client: ElasticsearchClient,
): Promise<ElasticAgentInventoryResult> {
  const data = await gracefulSearch(client, "logs-elastic_agent*", {
    size: 0,
    query: { range: { "@timestamp": { gte: "now-1h" } } },
    aggs: {
      agent_count: {
        cardinality: { field: "agent.id", precision_threshold: 40000 },
      },
      error_agents: {
        filter: { term: { "log.level": "error" } },
        aggs: {
          count: {
            cardinality: { field: "agent.id", precision_threshold: 40000 },
          },
        },
      },
      agents: {
        terms: { field: "agent.id", size: 500 },
        aggs: {
          latest: {
            top_hits: {
              size: 1,
              sort: [{ "@timestamp": { order: "desc" } }],
              _source: [
                "agent.id",
                "agent.version",
                "host.hostname",
                "host.os.name",
                "host.os.platform",
                "host.os.version",
                "host.os.full",
                "@timestamp",
              ],
            },
          },
          errors: {
            filter: { term: { "log.level": "error" } },
          },
        },
      },
    },
  });
  if (!data?.aggregations) return { agents: [], total: 0, errorAgentTotal: 0 };
  const aggData = parseFleetSchema(
    inventoryAggregationsSchema,
    data.aggregations,
    "Elastic Agent inventory aggregation",
  );
  const agentCount = aggData.agent_count;
  const errorAgentCount = aggData.error_agents;
  const agg = aggData.agents;
  if (!agg?.buckets) {
    return {
      agents: [],
      total: agentCount?.value ?? 0,
      errorAgentTotal: errorAgentCount?.count?.value ?? 0,
    };
  }
  const agents = agg.buckets.map((bucket) => {
    const source = bucket.latest.hits.hits[0]?._source ?? {};
    const osName = readNestedString(source, ["host", "os", "name"], "");
    const osPlatform = readNestedString(source, ["host", "os", "platform"], "");
    const osVersion = readNestedString(source, ["host", "os", "version"], "");
    const osFull = readNestedString(source, ["host", "os", "full"], "");
    const lastSeen = readNestedString(source, ["@timestamp"], "");
    return {
      agentId: bucket.key,
      hostname: readNestedString(source, ["host", "hostname"], "unknown"),
      version: readNestedString(source, ["agent", "version"], "unknown"),
      os: osName ? { name: osName, platform: osPlatform, version: osVersion, full: osFull } : null,
      lastSeen,
      logCount: bucket.doc_count,
      errorCount: bucket.errors.doc_count,
      status: deriveAgentStatus(lastSeen),
      policyId: "—",
    };
  });
  return {
    agents,
    total: agentCount?.value ?? agents.length,
    errorAgentTotal: errorAgentCount?.count?.value ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Single Elastic Agent info (filtered inventory for one agent)
// ---------------------------------------------------------------------------

export async function loadElasticAgentInfo(
  client: ElasticsearchClient,
  agentId: string,
): Promise<ElasticAgentInfo | null> {
  const data = await gracefulSearch(client, "logs-elastic_agent*", {
    size: 0,
    query: {
      bool: {
        must: [{ term: { "agent.id": agentId } }, { range: { "@timestamp": { gte: "now-1h" } } }],
      },
    },
    aggs: {
      agents: {
        terms: { field: "agent.id", size: 1 },
        aggs: {
          latest: {
            top_hits: {
              size: 1,
              sort: [{ "@timestamp": { order: "desc" } }],
              _source: [
                "agent.id",
                "agent.version",
                "host.hostname",
                "host.os.name",
                "host.os.platform",
                "host.os.version",
                "host.os.full",
                "@timestamp",
              ],
            },
          },
          errors: {
            filter: { term: { "log.level": "error" } },
          },
        },
      },
    },
  });
  if (!data?.aggregations) return null;
  const aggData = parseFleetSchema(
    inventoryAggregationsSchema,
    data.aggregations,
    "Elastic Agent info aggregation",
  );
  const agg = aggData.agents;
  const bucket = agg?.buckets?.[0];
  if (!bucket) return null;
  const source = bucket.latest.hits.hits[0]?._source ?? {};
  const osName = readNestedString(source, ["host", "os", "name"], "");
  const osPlatform = readNestedString(source, ["host", "os", "platform"], "");
  const osVersion = readNestedString(source, ["host", "os", "version"], "");
  const osFull = readNestedString(source, ["host", "os", "full"], "");
  const lastSeen = readNestedString(source, ["@timestamp"], "");
  return {
    agentId: bucket.key,
    hostname: readNestedString(source, ["host", "hostname"], "unknown"),
    version: readNestedString(source, ["agent", "version"], "unknown"),
    os: osName ? { name: osName, platform: osPlatform, version: osVersion, full: osFull } : null,
    lastSeen,
    logCount: bucket.doc_count,
    errorCount: bucket.errors.doc_count,
    status: deriveAgentStatus(lastSeen),
    policyId: "—",
  };
}

// ---------------------------------------------------------------------------
// Elastic Agent logs for a specific agent
// ---------------------------------------------------------------------------

export async function loadElasticAgentLogs(
  client: ElasticsearchClient,
  agentId: string,
  options: { size?: number; level?: string } = {},
): Promise<ElasticAgentLogEntry[]> {
  const { size = 100, level } = options;
  const must: Record<string, unknown>[] = [{ term: { "agent.id": agentId } }];
  if (level) {
    must.push({ term: { "log.level": level } });
  }
  const data = await gracefulSearch(client, "logs-elastic_agent*", {
    size,
    sort: [{ "@timestamp": { order: "desc" } }],
    _source: ["@timestamp", "log.level", "message", "component", "agent.id"],
    query: { bool: { must } },
  });
  return extractHits(data).map((hit) => {
    const source = parseFleetSchema(agentLogSourceSchema, hit._source, "Elastic Agent logs");
    return {
      timestamp: source["@timestamp"] ?? "",
      level: source.log?.level ?? "info",
      message: source.message ?? "",
      component: source.component ?? "",
      agentId: source.agent?.id ?? agentId,
    };
  });
}

// ---------------------------------------------------------------------------
// Elastic Agent metrics for a specific agent
// ---------------------------------------------------------------------------

export async function loadElasticAgentMetrics(
  client: ElasticsearchClient,
  agentId: string,
  size = 30,
): Promise<ElasticAgentMetricPoint[]> {
  const data = await gracefulSearch(client, "metrics-elastic_agent*", {
    size,
    sort: [{ "@timestamp": { order: "desc" } }],
    _source: [
      "@timestamp",
      "system.process.cpu.total.value",
      "system.process.memory.size",
      "system.process.fd.open",
      "beat.stats.libbeat.output.events.total",
    ],
    query: {
      bool: {
        must: [{ term: { "agent.id": agentId } }],
      },
    },
  });
  return extractHits(data).map((hit) => {
    const source = parseFleetSchema(agentMetricSourceSchema, hit._source, "Elastic Agent metrics");
    const systemProcess = source.system?.process;
    const cpuVal = systemProcess?.cpu?.total?.value;
    const memVal = systemProcess?.memory?.size;
    const fdVal = systemProcess?.fd?.open;
    const eventsVal = source.beat?.stats?.libbeat?.output?.events?.total;
    return {
      timestamp: source["@timestamp"] ?? "",
      cpuPct: cpuVal ?? null,
      memoryPct: memVal ?? null,
      handles: fdVal ?? null,
      eventsRate: eventsVal ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Fleet actions (from fleet-actions-sim)
// ---------------------------------------------------------------------------

export async function loadFleetActions(client: ElasticsearchClient): Promise<FleetAction[]> {
  const data = await gracefulSearch(client, "fleet-actions*", {
    size: 50,
    sort: [{ "@timestamp": { order: "desc", unmapped_type: "date" } }],
    _source: ["action_id", "type", "agents", "@timestamp", "expiration", "data"],
    query: { match_all: {} },
  });
  return extractHits(data).map((hit) => {
    const source = parseFleetSchema(actionSourceSchema, hit._source, "Fleet actions");
    return {
      id: source.action_id ?? hit._id ?? "",
      type: source.type ?? "UNKNOWN",
      agents: source.agents ?? [],
      createdAt: source["@timestamp"] ?? "",
      expiration: source.expiration ?? null,
      data: source.data ?? {},
    };
  });
}

// ---------------------------------------------------------------------------
// Fleet action results (from fleet-actions-results-sim)
// ---------------------------------------------------------------------------

export async function loadFleetActionResults(
  client: ElasticsearchClient,
): Promise<FleetActionResult[]> {
  const data = await gracefulSearch(client, "fleet-actions-results*", {
    size: 100,
    sort: [{ "@timestamp": { order: "desc", unmapped_type: "date" } }],
    _source: ["action_id", "agent_id", "error", "completed_at", "@timestamp"],
    query: { match_all: {} },
  });
  return extractHits(data).map((hit) => {
    const source = parseFleetSchema(actionResultSourceSchema, hit._source, "Fleet action results");
    return {
      actionId: source.action_id ?? "",
      agentId: source.agent_id ?? "",
      error: source.error ?? null,
      completedAt: source.completed_at ?? readNestedString(hit._source, ["@timestamp"], ""),
    };
  });
}

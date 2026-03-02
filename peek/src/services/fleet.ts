import { isElasticsearchError, type ElasticsearchClient, type ElasticsearchError } from "./es";

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

// ---------------------------------------------------------------------------
// Graceful search helper — returns null on 404 / index-not-found
// ---------------------------------------------------------------------------

interface SearchResponse {
  hits?: {
    total?: { value?: number } | number;
    hits?: Array<{ _id?: string; _source?: Record<string, unknown> }>;
  };
  aggregations?: Record<string, unknown>;
}

function extractSearchErrorMessage(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null) {
    const error = (body as Record<string, unknown>).error;
    if (typeof error === "object" && error !== null) {
      const reason = (error as Record<string, unknown>).reason;
      if (typeof reason === "string" && reason.length > 0) return reason;
      const rootCause = (error as Record<string, unknown>).root_cause;
      if (Array.isArray(rootCause) && rootCause.length > 0) {
        const firstReason = (rootCause[0] as Record<string, unknown>)?.reason;
        if (typeof firstReason === "string" && firstReason.length > 0) return firstReason;
      }
      const type = (error as Record<string, unknown>).type;
      if (typeof type === "string" && type.length > 0) return type;
    }
    const message = (body as Record<string, unknown>).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return `Elasticsearch search failed with status ${status}`;
}

function isMissingIndexError(
  error: Pick<ElasticsearchError, "status" | "message" | "cause">,
): boolean {
  if (error.status === 404) return true;
  const normalized = `${error.message} ${error.cause ?? ""}`.toLowerCase();
  return (
    normalized.includes("index_not_found_exception") ||
    normalized.includes("resource_not_found_exception") ||
    normalized.includes("no such index")
  );
}

async function gracefulSearch(
  client: ElasticsearchClient,
  index: string,
  body: Record<string, unknown>,
): Promise<SearchResponse | null> {
  try {
    const response = await client.rawRequest(
      "POST",
      `/${index}/_search?ignore_unavailable=true&allow_no_indices=true`,
      JSON.stringify(body),
    );
    if (response.status >= 400) {
      const error = {
        status: response.status,
        message: extractSearchErrorMessage(response.body, response.status),
      } satisfies ElasticsearchError;
      if (isMissingIndexError(error)) return null;
      throw error;
    }
    return response.body as SearchResponse;
  } catch (error) {
    if (isElasticsearchError(error) && isMissingIndexError(error)) {
      return null;
    }
    throw error;
  }
}

function extractHits(
  data: SearchResponse | null,
): Array<{ _id?: string; _source: Record<string, unknown> }> {
  if (!data?.hits?.hits) return [];
  return data.hits.hits.map((h) => ({ _id: h._id, _source: h._source ?? {} }));
}

function extractTotal(data: SearchResponse | null): number {
  if (!data?.hits) return 0;
  const total = data.hits.total;
  if (typeof total === "number") return total;
  if (typeof total?.value === "number") return total.value;
  return data.hits.hits?.length ?? 0;
}

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
  onlineAgents: number;
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
// Fleet Agent aggregation (kept for simulator / fallback)
// ---------------------------------------------------------------------------

export function aggregateFleetPolicies(agents: FleetAgentSummary[]): FleetPolicySummary[] {
  const policies = new Map<string, FleetPolicySummary>();
  for (const agent of agents) {
    const policyId = agent.policyId || "unknown";
    const current = policies.get(policyId) ?? {
      policyId,
      agents: 0,
      onlineAgents: 0,
      degradedAgents: 0,
      errorAgents: 0,
      inactiveAgents: 0,
    };
    current.agents += 1;
    const status = agent.status.trim().toLowerCase();
    if (status === "online") current.onlineAgents += 1;
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
  const agents = readNested(source, ["fleet", "agents"]) as Record<string, unknown> | undefined;
  if (!agents) return null;
  const reasons = (agents.unhealthy_reason ?? {}) as Record<string, unknown>;
  return {
    total: (agents.total as number) ?? 0,
    healthy: (agents.healthy as number) ?? 0,
    unhealthy: (agents.unhealthy as number) ?? 0,
    offline: (agents.offline as number) ?? 0,
    updating: (agents.updating as number) ?? 0,
    inactive: (agents.inactive as number) ?? 0,
    enrolled: (agents.enrolled as number) ?? 0,
    unenrolled: (agents.unenrolled as number) ?? 0,
    unhealthyReason: {
      input: (reasons.input as number) ?? 0,
      output: (reasons.output as number) ?? 0,
      other: (reasons.other as number) ?? 0,
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
  const byOutput = data.aggregations.by_output as {
    buckets?: Array<{
      key: string;
      latest: { hits: { hits: Array<{ _source: Record<string, unknown> }> } };
    }>;
  };
  if (!byOutput?.buckets) return [];
  return byOutput.buckets.map((bucket) => {
    const source = bucket.latest.hits.hits[0]?._source ?? {};
    return {
      output: (source.output as string) ?? bucket.key,
      state: (source.state as string) ?? "UNKNOWN",
      message: (source.message as string) ?? "",
      timestamp: (source["@timestamp"] as string) ?? "",
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
  const agentCount = data.aggregations.agent_count as { value?: number } | undefined;
  const errorAgentCount = data.aggregations.error_agents as
    | { count?: { value?: number } }
    | undefined;
  const agg = data.aggregations.agents as {
    buckets?: Array<{
      key: string;
      doc_count: number;
      latest: { hits: { hits: Array<{ _source: Record<string, unknown> }> } };
      errors: { doc_count: number };
    }>;
  };
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
    return {
      agentId: bucket.key,
      hostname: readNestedString(source, ["host", "hostname"], "unknown"),
      version: readNestedString(source, ["agent", "version"], "unknown"),
      os: osName ? { name: osName, platform: osPlatform, version: osVersion, full: osFull } : null,
      lastSeen: readNestedString(source, ["@timestamp"], ""),
      logCount: bucket.doc_count,
      errorCount: bucket.errors.doc_count,
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
  const agg = data.aggregations.agents as {
    buckets?: Array<{
      key: string;
      doc_count: number;
      latest: { hits: { hits: Array<{ _source: Record<string, unknown> }> } };
      errors: { doc_count: number };
    }>;
  };
  const bucket = agg?.buckets?.[0];
  if (!bucket) return null;
  const source = bucket.latest.hits.hits[0]?._source ?? {};
  const osName = readNestedString(source, ["host", "os", "name"], "");
  const osPlatform = readNestedString(source, ["host", "os", "platform"], "");
  const osVersion = readNestedString(source, ["host", "os", "version"], "");
  const osFull = readNestedString(source, ["host", "os", "full"], "");
  return {
    agentId: bucket.key,
    hostname: readNestedString(source, ["host", "hostname"], "unknown"),
    version: readNestedString(source, ["agent", "version"], "unknown"),
    os: osName ? { name: osName, platform: osPlatform, version: osVersion, full: osFull } : null,
    lastSeen: readNestedString(source, ["@timestamp"], ""),
    logCount: bucket.doc_count,
    errorCount: bucket.errors.doc_count,
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
  return extractHits(data).map((hit) => ({
    timestamp: readNestedString(hit._source, ["@timestamp"], ""),
    level: readNestedString(hit._source, ["log", "level"], "info"),
    message: (hit._source.message as string) ?? "",
    component: (hit._source.component as string) ?? "",
    agentId: readNestedString(hit._source, ["agent", "id"], agentId),
  }));
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
    const source = hit._source;
    const ts = source["@timestamp"];
    const systemProcess = (source.system as { process?: Record<string, unknown> } | undefined)
      ?.process;
    const cpuVal = (systemProcess?.cpu as { total?: { value?: unknown } } | undefined)?.total
      ?.value;
    const memVal = (systemProcess?.memory as { size?: unknown } | undefined)?.size;
    const fdVal = (systemProcess?.fd as { open?: unknown } | undefined)?.open;
    const eventsVal = (
      source.beat as {
        stats?: { libbeat?: { output?: { events?: { total?: unknown } } } };
      }
    )?.stats?.libbeat?.output?.events?.total;
    return {
      timestamp: typeof ts === "string" && ts.length > 0 ? ts : "",
      cpuPct: typeof cpuVal === "number" ? cpuVal : null,
      memoryPct: typeof memVal === "number" ? memVal : null,
      handles: typeof fdVal === "number" ? fdVal : null,
      eventsRate: typeof eventsVal === "number" ? eventsVal : null,
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
  return extractHits(data).map((hit) => ({
    id: (hit._source.action_id as string) ?? hit._id ?? "",
    type: (hit._source.type as string) ?? "UNKNOWN",
    agents: Array.isArray(hit._source.agents) ? (hit._source.agents as string[]) : [],
    createdAt: readNestedString(hit._source, ["@timestamp"], ""),
    expiration:
      typeof hit._source.expiration === "string" ? (hit._source.expiration as string) : null,
    data: (hit._source.data as Record<string, unknown>) ?? {},
  }));
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
  return extractHits(data).map((hit) => ({
    actionId: (hit._source.action_id as string) ?? "",
    agentId: (hit._source.agent_id as string) ?? "",
    error: typeof hit._source.error === "string" ? (hit._source.error as string) : null,
    completedAt:
      (hit._source.completed_at as string) ?? readNestedString(hit._source, ["@timestamp"], ""),
  }));
}

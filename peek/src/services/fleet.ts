import type { ElasticsearchClient } from "./es";

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

export function fleetStatusColor(
  status: string,
): "default" | "primary" | "secondary" | "success" | "warning" | "error" {
  const normalized = status.toLowerCase();
  if (normalized === "online") return "success";
  if (normalized === "error") return "error";
  if (normalized === "degraded" || normalized === "warning") return "warning";
  return "default";
}

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

function readNestedString(
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

function readNestedNumber(source: Record<string, unknown>, path: string[]): number | null {
  let current: unknown = source;
  for (const key of path) {
    if (typeof current !== "object" || current === null || !(key in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "number" ? current : null;
}

export async function loadFleetAgents(
  client: ElasticsearchClient,
): Promise<FleetAgentSearchResult> {
  const response = await client.rawRequest(
    "POST",
    "/.fleet-agents*,fleet-agents*/_search?ignore_unavailable=true&allow_no_indices=true",
    JSON.stringify({
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
    }),
  );
  if (response.status >= 400) {
    const body = response.body as { error?: { reason?: string } } | null;
    throw {
      status: response.status,
      message: body?.error?.reason ?? "Failed to load Fleet agents.",
    };
  }
  const result = (
    response.body as {
      hits?: {
        total?: { value?: number } | number;
        hits?: Array<{ _id?: string; _source?: Record<string, unknown> }>;
      };
    } | null
  )?.hits;
  const hits = result?.hits;
  const total =
    typeof result?.total === "number"
      ? result.total
      : typeof result?.total?.value === "number"
        ? result.total.value
        : (hits?.length ?? 0);
  if (!hits) return { total: 0, agents: [] };
  return {
    total,
    agents: hits.map((hit) => {
      const source = hit._source ?? {};
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

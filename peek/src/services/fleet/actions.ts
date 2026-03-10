import { type ElasticsearchClient } from "../es";
import { extractHits, gracefulSearch } from "../es/searchHelpers";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Internal helpers (shared with parent module; will be consolidated in a
// future refactor step — see incremental rollout plan)
// ---------------------------------------------------------------------------

function parseFleetSchema<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const parsed = schema.safeParse(data);
  if (parsed.success) {
    return parsed.data;
  }
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Unexpected ${label} response shape: ${issues.join("; ")}`);
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

// ---------------------------------------------------------------------------
// Zod schemas for Fleet action documents
// ---------------------------------------------------------------------------

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

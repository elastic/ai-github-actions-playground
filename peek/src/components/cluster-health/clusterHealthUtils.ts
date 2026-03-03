import type {
  CatShardRecord,
  ClusterPendingTask,
  ClusterSettingsResponse,
  NodeStatsNode,
} from "../../services/es";

import type { InfoCardSeverity } from "./InfoCard";

// ---------------------------------------------------------------------------
// Disk watermarks
// ---------------------------------------------------------------------------

export interface DiskWatermarks {
  low: number;
  high: number;
  flood: number;
}

function parseWatermarkPercent(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) {
    const parsed = parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  // Byte-based watermarks (e.g. "500gb") can't be compared without disk size
  return fallback;
}

/** Extract disk watermark thresholds from cluster settings, falling back to ES defaults. */
export function getDiskWatermarks(settings: ClusterSettingsResponse | null): DiskWatermarks {
  const get = (key: string): string | undefined => {
    const flat = `cluster.routing.allocation.disk.watermark.${key}`;
    return (
      (settings?.transient?.[flat] as string | undefined) ??
      (settings?.persistent?.[flat] as string | undefined) ??
      (settings?.defaults?.[flat] as string | undefined)
    );
  };
  return {
    low: parseWatermarkPercent(get("low"), 85),
    high: parseWatermarkPercent(get("high"), 90),
    flood: parseWatermarkPercent(get("flood_stage"), 95),
  };
}

/** Check if shard allocation is disabled or restricted. */
export function isAllocationDisabled(settings: ClusterSettingsResponse | null): boolean {
  const key = "cluster.routing.allocation.enable";
  const value =
    (settings?.transient?.[key] as string | undefined) ??
    (settings?.persistent?.[key] as string | undefined) ??
    (settings?.defaults?.[key] as string | undefined) ??
    "all";
  return value !== "all";
}

// ---------------------------------------------------------------------------
// Thread pool rejections
// ---------------------------------------------------------------------------

export interface ThreadPoolRejection {
  pool: string;
  nodeName: string;
  rejected: number;
}

export const MONITORED_THREAD_POOLS = ["write", "search", "get"] as const;

/** Aggregate thread pool rejections across nodes. */
export function getThreadPoolRejections(
  nodes: Record<string, NodeStatsNode> | undefined,
  pools: readonly string[] = MONITORED_THREAD_POOLS,
): ThreadPoolRejection[] {
  if (!nodes) return [];
  const results: ThreadPoolRejection[] = [];
  for (const node of Object.values(nodes)) {
    for (const pool of pools) {
      const rejected = node.thread_pool?.[pool]?.rejected;
      if (rejected != null && rejected > 0) {
        results.push({ pool, nodeName: node.name ?? "unknown", rejected });
      }
    }
  }
  return results;
}

/** Sum total rejections across all nodes and pools. */
export function totalThreadPoolRejections(
  nodes: Record<string, NodeStatsNode> | undefined,
  pools: readonly string[] = MONITORED_THREAD_POOLS,
): number {
  return getThreadPoolRejections(nodes, pools).reduce((sum, r) => sum + r.rejected, 0);
}

/** Sum rejections for a single node across monitored pools. */
export function nodeThreadPoolRejections(
  node: NodeStatsNode,
  pools: readonly string[] = MONITORED_THREAD_POOLS,
): number {
  return pools.reduce((sum, p) => sum + (node.thread_pool?.[p]?.rejected ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Circuit breakers
// ---------------------------------------------------------------------------

export interface CircuitBreakerTrip {
  breaker: string;
  nodeName: string;
  tripped: number;
}

export const MONITORED_BREAKERS = ["parent", "fielddata", "request", "in_flight_requests"] as const;

/** Aggregate circuit breaker trips across nodes. */
export function getCircuitBreakerTrips(
  nodes: Record<string, NodeStatsNode> | undefined,
  breakerNames: readonly string[] = MONITORED_BREAKERS,
): CircuitBreakerTrip[] {
  if (!nodes) return [];
  const results: CircuitBreakerTrip[] = [];
  for (const node of Object.values(nodes)) {
    for (const name of breakerNames) {
      const tripped = node.breakers?.[name]?.tripped;
      if (tripped != null && tripped > 0) {
        results.push({ breaker: name, nodeName: node.name ?? "unknown", tripped });
      }
    }
  }
  return results;
}

/** Sum total breaker trips across all nodes. */
export function totalCircuitBreakerTrips(
  nodes: Record<string, NodeStatsNode> | undefined,
  breakerNames: readonly string[] = MONITORED_BREAKERS,
): number {
  return getCircuitBreakerTrips(nodes, breakerNames).reduce((sum, t) => sum + t.tripped, 0);
}

/** Sum breaker trips for a single node across monitored breakers. */
export function nodeCircuitBreakerTrips(
  node: NodeStatsNode,
  breakerNames: readonly string[] = MONITORED_BREAKERS,
): number {
  return breakerNames.reduce((sum, b) => sum + (node.breakers?.[b]?.tripped ?? 0), 0);
}

// ---------------------------------------------------------------------------
// GC summary
// ---------------------------------------------------------------------------

export interface GcSummary {
  nodeName: string;
  youngCount: number;
  youngTimeMs: number;
  oldCount: number;
  oldTimeMs: number;
}

/** Extract GC summary per node. */
export function getGcSummary(nodes: Record<string, NodeStatsNode> | undefined): GcSummary[] {
  if (!nodes) return [];
  return Object.values(nodes).map((node) => ({
    nodeName: node.name ?? "unknown",
    youngCount: node.jvm?.gc?.collectors?.young?.collection_count ?? 0,
    youngTimeMs: node.jvm?.gc?.collectors?.young?.collection_time_in_millis ?? 0,
    oldCount: node.jvm?.gc?.collectors?.old?.collection_count ?? 0,
    oldTimeMs: node.jvm?.gc?.collectors?.old?.collection_time_in_millis ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Severity thresholds
// ---------------------------------------------------------------------------

/** Determine InfoCard severity based on a percentage and thresholds. */
export function percentSeverity(
  value: number | null | undefined,
  warnAt: number,
  errorAt: number,
): InfoCardSeverity | undefined {
  if (value == null) return undefined;
  if (value >= errorAt) return "error";
  if (value >= warnAt) return "warning";
  return "success";
}

// ---------------------------------------------------------------------------
// Pending task grouping
// ---------------------------------------------------------------------------

/** Group pending tasks by priority. */
export function groupPendingTasks(tasks: ClusterPendingTask[]): Map<string, ClusterPendingTask[]> {
  const groups = new Map<string, ClusterPendingTask[]>();
  for (const task of tasks) {
    const priority = task.priority ?? "UNKNOWN";
    if (!groups.has(priority)) groups.set(priority, []);
    groups.get(priority)!.push(task);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Unassigned shard reasons
// ---------------------------------------------------------------------------

/** Group unassigned shards by reason. */
export function groupUnassignedReasons(shards: CatShardRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const shard of shards) {
    if (shard.state === "UNASSIGNED") {
      const reason = shard["unassigned.reason"] ?? "UNKNOWN";
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Node stat helpers
// ---------------------------------------------------------------------------

/** Parse a string value from _cat APIs to a number, returning null for invalid values. */
export function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

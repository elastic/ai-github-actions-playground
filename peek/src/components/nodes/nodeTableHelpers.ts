// ── Role abbreviation map ─────────────────────────────────────────────────

export const ROLE_ABBR: Record<string, string> = {
  master: "master",
  data: "data",
  data_hot: "hot",
  data_warm: "warm",
  data_cold: "cold",
  data_frozen: "frozen",
  data_content: "content",
  ingest: "ingest",
  ml: "ml",
  remote_cluster_client: "rcc",
  transform: "transform",
  voting_only: "voting",
  coordinating_only: "coord",
};

export const ROLE_LABEL: Record<string, string> = {
  master: "Master",
  data: "Data",
  data_hot: "Data hot",
  data_warm: "Data warm",
  data_cold: "Data cold",
  data_frozen: "Data frozen",
  data_content: "Data content",
  ingest: "Ingest",
  ml: "Machine learning",
  remote_cluster_client: "Remote cluster client",
  transform: "Transform",
  voting_only: "Voting only",
  coordinating_only: "Coordinating only",
};

export function abbrevRole(role: string): string {
  return ROLE_ABBR[role] ?? role;
}

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

// ── Health classification ─────────────────────────────────────────────────

export type HealthLevel = "critical" | "warning" | "ok" | "unknown";

export const NODE_THRESHOLDS = {
  cpu: { warning: 70, critical: 90 },
  heap: { warning: 75, critical: 90 },
  disk: { warning: 85, critical: 95 },
} as const;

export interface NodeTableRow {
  id: string;
  name: string;
  transportAddress: string | null;
  roles: string[];
  version: string;
  cpuPercent: number | null;
  load1m: number | null;
  heapPercent: number | null;
  gcOldCount: number | null;
  gcOldMs: number | null;
  fsUsedPercent: number | null;
  totalThreadRejections: number | null;
  totalBreakerTrips: number | null;
  docCount: number | null;
  shardCount: number | null;
}

export function nodeHealth(row: NodeTableRow): HealthLevel {
  // Critical: heap >= 90%, disk >= 95%, any breaker trips
  if (row.heapPercent !== null && row.heapPercent >= NODE_THRESHOLDS.heap.critical)
    return "critical";
  if (row.fsUsedPercent !== null && row.fsUsedPercent >= NODE_THRESHOLDS.disk.critical)
    return "critical";
  if (row.totalBreakerTrips !== null && row.totalBreakerTrips > 0) return "critical";
  if (row.heapPercent === null && row.fsUsedPercent === null) {
    return "unknown";
  }
  // Warning: heap >= 75%, disk >= 85%
  if (row.heapPercent !== null && row.heapPercent >= NODE_THRESHOLDS.heap.warning) return "warning";
  if (row.fsUsedPercent !== null && row.fsUsedPercent >= NODE_THRESHOLDS.disk.warning)
    return "warning";
  return "ok";
}

// ── Metric cell coloring ──────────────────────────────────────────────────

export type MetricLevel = "ok" | "warning" | "critical";

export function percentLevel(
  pct: number,
  warnThreshold: number,
  critThreshold: number,
): MetricLevel {
  if (pct >= critThreshold) return "critical";
  if (pct >= warnThreshold) return "warning";
  return "ok";
}

export function levelColor(level: MetricLevel): string | undefined {
  if (level === "critical") return "error.main";
  if (level === "warning") return "warning.main";
  return undefined;
}

// ── Summary metrics ───────────────────────────────────────────────────────

export interface NodeSummary {
  count: number;
  maxCpu: number | null;
  avgCpu: number | null;
  maxHeap: number | null;
  avgHeap: number | null;
  maxDisk: number | null;
  avgDisk: number | null;
  totalDocs: number | null;
  totalShards: number | null;
}

export function computeSummary(rows: NodeTableRow[]): NodeSummary {
  const cpus = rows.map((r) => r.cpuPercent).filter((v): v is number => v !== null);
  const heaps = rows.map((r) => r.heapPercent).filter((v): v is number => v !== null);
  const disks = rows.map((r) => r.fsUsedPercent).filter((v): v is number => v !== null);
  const hasCpuGaps = rows.length === 0 || cpus.length !== rows.length;
  const hasHeapGaps = rows.length === 0 || heaps.length !== rows.length;
  const hasDiskGaps = rows.length === 0 || disks.length !== rows.length;
  const hasDocGaps = rows.some((r) => r.docCount === null);
  const hasShardGaps = rows.some((r) => r.shardCount === null);

  return {
    count: rows.length,
    maxCpu: hasCpuGaps ? null : Math.max(...cpus),
    avgCpu: hasCpuGaps ? null : cpus.reduce((a, b) => a + b, 0) / cpus.length,
    maxHeap: hasHeapGaps ? null : Math.max(...heaps),
    avgHeap: hasHeapGaps ? null : heaps.reduce((a, b) => a + b, 0) / heaps.length,
    maxDisk: hasDiskGaps ? null : Math.max(...disks),
    avgDisk: hasDiskGaps ? null : disks.reduce((a, b) => a + b, 0) / disks.length,
    totalDocs: hasDocGaps ? null : rows.reduce((sum, r) => sum + (r.docCount ?? 0), 0),
    totalShards: hasShardGaps ? null : rows.reduce((sum, r) => sum + (r.shardCount ?? 0), 0),
  };
}

import type { TransformRow } from "../../services/es";

// ---------------------------------------------------------------------------
// Sort types and helpers
// ---------------------------------------------------------------------------

export type SortField =
  | "healthStatus"
  | "state"
  | "id"
  | "type"
  | "docsProcessed"
  | "docsIndexed"
  | "searchFailures"
  | "indexFailures"
  | "checkpoint"
  | "avgCheckpointDurationMs"
  | "nodeName";

export type SortDirection = "asc" | "desc";

const HEALTH_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2, unknown: 3 };
const STATE_ORDER: Record<string, number> = {
  failed: 0,
  aborting: 1,
  stopping: 2,
  stopped: 3,
  started: 4,
  unknown: 5,
};

export function compareTransformRows(a: TransformRow, b: TransformRow, field: SortField): number {
  switch (field) {
    case "healthStatus":
      return (HEALTH_ORDER[a.healthStatus] ?? 99) - (HEALTH_ORDER[b.healthStatus] ?? 99);
    case "state":
      return (STATE_ORDER[a.state] ?? 99) - (STATE_ORDER[b.state] ?? 99);
    case "id":
      return a.id.localeCompare(b.id);
    case "type":
      return a.type.localeCompare(b.type);
    case "nodeName":
      return a.nodeName.localeCompare(b.nodeName);
    case "docsProcessed":
      return a.docsProcessed - b.docsProcessed;
    case "docsIndexed":
      return a.docsIndexed - b.docsIndexed;
    case "searchFailures":
      return a.searchFailures - b.searchFailures;
    case "indexFailures":
      return a.indexFailures - b.indexFailures;
    case "checkpoint":
      return a.checkpoint - b.checkpoint;
    case "avgCheckpointDurationMs":
      return a.avgCheckpointDurationMs - b.avgCheckpointDurationMs;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatNum(n: number): string {
  return n.toLocaleString();
}

export function formatMs(ms: number): string {
  if (ms === 0) return "—";
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

export function healthColor(status: string): "success" | "warning" | "error" | "default" {
  if (status === "green") return "success";
  if (status === "yellow") return "warning";
  if (status === "red") return "error";
  return "default";
}

export function stateColor(
  state: string,
): "success" | "error" | "warning" | "default" | "info" | "secondary" {
  if (state === "started") return "success";
  if (state === "failed") return "error";
  if (state === "stopping" || state === "aborting") return "warning";
  if (state === "stopped") return "default";
  return "secondary";
}

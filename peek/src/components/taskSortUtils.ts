import type { TaskRow } from "../services/es";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortField = "action" | "node" | "runningTime" | "startTime" | "type" | "cancellable";
export type SortDirection = "asc" | "desc";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LONG_RUNNING_THRESHOLD_NS = 60_000_000_000; // 60 seconds

// ---------------------------------------------------------------------------
// Comparator
// ---------------------------------------------------------------------------

export function compareTasks(a: TaskRow, b: TaskRow, field: SortField, dir: SortDirection): number {
  let cmp: number;
  switch (field) {
    case "action":
      cmp = a.action.localeCompare(b.action);
      break;
    case "node":
      cmp = a.node.localeCompare(b.node);
      break;
    case "type":
      cmp = a.type.localeCompare(b.type);
      break;
    case "runningTime":
      cmp = a.runningTimeNanos - b.runningTimeNanos;
      break;
    case "startTime":
      cmp = a.startTimeMs - b.startTimeMs;
      break;
    case "cancellable":
      cmp = Number(a.cancellable) - Number(b.cancellable);
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatNanos(nanos: number): string {
  const ms = nanos / 1_000_000;
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  const sec = ms / 1_000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = sec / 60;
  if (min < 60) return `${min.toFixed(1)}m`;
  const hr = min / 60;
  return `${hr.toFixed(1)}h`;
}

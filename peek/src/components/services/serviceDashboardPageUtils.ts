import type { RouteRow, RecentTrace, SortDirection } from "./serviceDashboardHelpers";
import type { ServiceDashboardSummary } from "./ServiceDashboardSummaryCards";

export function compareByField<T extends RouteRow | RecentTrace, K extends keyof T>(
  a: T,
  b: T,
  field: K,
  direction: SortDirection,
): number {
  const aVal = a[field];
  const bVal = b[field];
  if (typeof aVal === "string" && typeof bVal === "string") {
    return direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  }
  return direction === "asc"
    ? (aVal as number) - (bVal as number)
    : (bVal as number) - (aVal as number);
}

export function buildDashboardSummary(routeRows: RouteRow[]): ServiceDashboardSummary | null {
  if (routeRows.length === 0) return null;

  const totals = routeRows.reduce(
    (acc, row) => {
      acc.requests += row.requestCount;
      acc.errors += row.errorCount;
      return acc;
    },
    { requests: 0, errors: 0 },
  );
  const avgLatencyMs =
    totals.requests > 0
      ? routeRows.reduce((acc, row) => acc + row.avgLatencyMs * row.requestCount, 0) /
        totals.requests
      : 0;

  return {
    totalRequests: totals.requests,
    totalErrors: totals.errors,
    overallErrorRate: totals.requests > 0 ? totals.errors / totals.requests : 0,
    avgLatencyMs,
    uniqueRoutes: routeRows.length,
  };
}

export function decodeServiceName(rawServiceName: string): string {
  try {
    return decodeURIComponent(rawServiceName);
  } catch {
    return rawServiceName;
  }
}

export function normalizeStatusLabel(statusCode: string): string {
  if (!statusCode || statusCode === "STATUS_CODE_OK") return "OK";
  if (statusCode === "STATUS_CODE_ERROR") return "Error";
  return statusCode;
}

export interface SlowOperationSignal {
  name: string;
  count: number;
  maxDurationMs: number;
  avgDurationMs: number;
}

export function aggregateSlowOperations(
  traces: RecentTrace[],
  limit: number,
): SlowOperationSignal[] {
  const byOperation = new Map<
    string,
    { count: number; maxDurationMs: number; avgDurationMs: number }
  >();
  for (const trace of traces) {
    const key = trace.spanName || "unknown";
    const current = byOperation.get(key);
    if (!current) {
      byOperation.set(key, {
        count: 1,
        maxDurationMs: trace.durationMs,
        avgDurationMs: trace.durationMs,
      });
    } else {
      const nextCount = current.count + 1;
      byOperation.set(key, {
        count: nextCount,
        maxDurationMs: Math.max(current.maxDurationMs, trace.durationMs),
        avgDurationMs: (current.avgDurationMs * current.count + trace.durationMs) / nextCount,
      });
    }
  }
  return Array.from(byOperation.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.maxDurationMs - a.maxDurationMs)
    .slice(0, limit);
}

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

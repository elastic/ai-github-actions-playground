import type { EsqlResponse } from "../../types";

export interface RouteRow {
  route: string;
  requestCount: number;
  avgLatencyMs: number;
  errorCount: number;
  errorRate: number;
}

export interface RecentTrace {
  traceId: string;
  spanName: string;
  durationMs: number;
  statusCode: string;
  timestamp: string;
}

export type RouteSortField = "route" | "requestCount" | "avgLatencyMs" | "errorRate";
export type TraceSortField = "spanName" | "durationMs" | "statusCode" | "timestamp";
export type SortDirection = "asc" | "desc";

function buildColumnAccessor(columns: EsqlResponse["columns"]) {
  const colIndex = new Map<string, number>();
  for (let i = 0; i < columns.length; i++) {
    colIndex.set(columns[i]!.name, i);
  }
  return (row: unknown[], field: string): unknown => {
    const idx = colIndex.get(field);
    return idx !== undefined ? row[idx] : null;
  };
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseRouteRows(result: EsqlResponse): RouteRow[] {
  const get = buildColumnAccessor(result.columns);

  return result.values.map((row) => ({
    route: String(get(row, "route_key") ?? "/"),
    requestCount: toFiniteNumber(get(row, "request_count")),
    avgLatencyMs: toFiniteNumber(get(row, "avg_latency_ms")),
    errorCount: toFiniteNumber(get(row, "error_count")),
    errorRate: toFiniteNumber(get(row, "error_rate")),
  }));
}

export function parseRecentTraces(result: EsqlResponse): RecentTrace[] {
  const get = buildColumnAccessor(result.columns);

  return result.values.map((row) => ({
    traceId: String(get(row, "trace.id") ?? ""),
    spanName: String(get(row, "name") ?? "unknown"),
    durationMs: toFiniteNumber(get(row, "duration_ms")),
    statusCode: String(get(row, "status.code") ?? ""),
    timestamp: String(get(row, "@timestamp") ?? ""),
  }));
}

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

export function parseRouteRows(result: EsqlResponse): RouteRow[] {
  const colIndex = new Map<string, number>();
  for (let i = 0; i < result.columns.length; i++) {
    colIndex.set(result.columns[i]!.name, i);
  }
  const get = (row: unknown[], field: string): unknown => {
    const idx = colIndex.get(field);
    return idx !== undefined ? row[idx] : null;
  };

  return result.values.map((row) => ({
    route: String(get(row, "route_key") ?? "/"),
    requestCount: Number(get(row, "request_count") ?? 0),
    avgLatencyMs: Number(get(row, "avg_latency_ms") ?? 0),
    errorCount: Number(get(row, "error_count") ?? 0),
    errorRate: Number(get(row, "error_rate") ?? 0),
  }));
}

export function parseRecentTraces(result: EsqlResponse): RecentTrace[] {
  const colIndex = new Map<string, number>();
  for (let i = 0; i < result.columns.length; i++) {
    colIndex.set(result.columns[i]!.name, i);
  }
  const get = (row: unknown[], field: string): unknown => {
    const idx = colIndex.get(field);
    return idx !== undefined ? row[idx] : null;
  };

  return result.values.map((row) => ({
    traceId: String(get(row, "trace.id") ?? ""),
    spanName: String(get(row, "name") ?? "unknown"),
    durationMs: Number(get(row, "duration_ms") ?? 0),
    statusCode: String(get(row, "status.code") ?? ""),
    timestamp: String(get(row, "@timestamp") ?? ""),
  }));
}

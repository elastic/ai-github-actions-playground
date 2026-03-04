import type { EsqlResponse } from "../../types";
import { buildColumnAccessor, toFiniteNumber } from "../../services/es/columnUtils";

/** A Kubernetes resource associated with a service. */
export interface ServiceK8sRow {
  namespace: string;
  node: string;
  pod: string;
  podCount: number;
}

export function parseServiceK8sContext(result: EsqlResponse): ServiceK8sRow[] {
  const get = buildColumnAccessor(result.columns);

  return result.values
    .map((row) => ({
      namespace: String(get(row, "k8s_namespace") ?? "").trim(),
      node: String(get(row, "k8s_node") ?? "").trim(),
      pod: String(get(row, "k8s_pod") ?? "").trim(),
      podCount: toFiniteNumber(get(row, "pod_count")),
    }))
    .filter((row) => row.pod.length > 0);
}

export interface RouteRow {
  route: string;
  requestCount: number;
  avgLatencyMs: number;
  errorCount: number;
  errorRate: number;
}

export interface RecentTrace {
  traceId: string;
  spanId: string;
  spanName: string;
  durationMs: number;
  statusCode: string;
  timestamp: string;
}

export type RouteSortField = "route" | "requestCount" | "avgLatencyMs" | "errorRate";
export type TraceSortField = "spanName" | "durationMs" | "statusCode" | "timestamp";
export type SortDirection = "asc" | "desc";

function toNonEmptyString(value: unknown, fallback: string): string {
  const parsed = String(value ?? "").trim();
  return parsed.length > 0 ? parsed : fallback;
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
    spanId: String(get(row, "span.id") ?? ""),
    spanName: String(get(row, "name") ?? "unknown"),
    durationMs: toFiniteNumber(get(row, "duration_ms")),
    statusCode: String(get(row, "status.code") ?? ""),
    timestamp: String(get(row, "@timestamp") ?? ""),
  }));
}

export interface DeploymentRow {
  version: string;
  firstSeen: string;
  lastSeen: string;
  requestCount: number;
}

export function parseDeploymentRows(result: EsqlResponse): DeploymentRow[] {
  const get = buildColumnAccessor(result.columns);

  return result.values.map((row) => ({
    version: toNonEmptyString(get(row, "version_key"), "unknown"),
    firstSeen: String(get(row, "first_seen") ?? ""),
    lastSeen: String(get(row, "last_seen") ?? ""),
    requestCount: toFiniteNumber(get(row, "request_count")),
  }));
}

/** Time-bucketed data point for a route sparkline. */
export type SparklinePoint = [number, number]; // [timestamp, value]

/** Per-route sparkline series for requests, latency, and error rate. */
export interface RouteSparklineData {
  requests: SparklinePoint[];
  latency: SparklinePoint[];
  errorRate: SparklinePoint[];
}

/**
 * Parses an ES|QL response from `buildServiceRouteSparklineQuery` into a map
 * of route → sparkline data.
 */
export function parseRouteSparklineData(result: EsqlResponse): Record<string, RouteSparklineData> {
  const get = buildColumnAccessor(result.columns);

  const map = Object.create(null) as Record<string, RouteSparklineData>;
  for (const row of result.values) {
    const route = String(get(row, "route_key") ?? "/");
    const tsRaw = get(row, "bucket");
    const ts = tsRaw == null ? null : new Date(tsRaw as string).getTime();
    if (ts === null || !Number.isFinite(ts)) continue;
    if (!map[route]) {
      map[route] = { requests: [], latency: [], errorRate: [] };
    }
    const entry = map[route]!;
    entry.requests.push([ts, toFiniteNumber(get(row, "request_count"))]);
    entry.latency.push([ts, toFiniteNumber(get(row, "avg_latency_ms"))]);
    entry.errorRate.push([ts, toFiniteNumber(get(row, "error_rate"))]);
  }
  return map;
}

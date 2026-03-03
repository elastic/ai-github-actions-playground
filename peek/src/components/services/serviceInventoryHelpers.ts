import type { EsqlResponse } from "../../types";

export interface ServiceRow {
  serviceName: string;
  requestCount: number;
  avgLatencyMs: number;
  errorCount: number;
  errorRate: number;
  uniqueRoutes: number;
  uniqueSpanNames: number;
  topRoute: string;
  topSpanName: string;
  topError: string;
  language: string;
  environment: string;
}

export type SortField = "serviceName" | "requestCount" | "avgLatencyMs" | "errorRate";
export type SortDirection = "asc" | "desc";

export function parseTopValue(value: unknown, fallback = "—"): string {
  if (Array.isArray(value)) {
    const top = value.find((item) => item != null && String(item).trim() !== "");
    return top != null ? String(top) : fallback;
  }
  if (value == null) return fallback;
  const parsed = String(value).trim();
  return parsed.length > 0 ? parsed : fallback;
}

export function parseServiceRows(result: EsqlResponse): ServiceRow[] {
  const colIndex = new Map<string, number>();
  for (let i = 0; i < result.columns.length; i++) {
    colIndex.set(result.columns[i]!.name, i);
  }
  const get = (row: unknown[], field: string): unknown => {
    const idx = colIndex.get(field);
    return idx !== undefined ? row[idx] : null;
  };

  return result.values.map((row) => ({
    serviceName: String(get(row, "service.name") ?? "unknown"),
    requestCount: Number(get(row, "request_count") ?? 0),
    avgLatencyMs: Number(get(row, "avg_latency_ms") ?? 0),
    errorCount: Number(get(row, "error_count") ?? 0),
    errorRate: Number(get(row, "error_rate") ?? 0),
    uniqueRoutes: Number(get(row, "unique_routes") ?? 0),
    uniqueSpanNames: Number(get(row, "unique_span_names") ?? 0),
    topRoute: parseTopValue(get(row, "top_route")),
    topSpanName: parseTopValue(get(row, "top_span_name")),
    topError: parseTopValue(get(row, "top_error")),
    language: parseTopValue(get(row, "language"), "unknown"),
    environment: parseTopValue(get(row, "environment"), "unknown"),
  }));
}

export function formatLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s`;
  return `${ms.toFixed(1)}ms`;
}

export function formatErrorRate(rate: number): string {
  if (!Number.isFinite(rate) || rate < 0) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

/** Time-bucketed data point for a service sparkline. */
export type SparklinePoint = [number, number]; // [timestamp, value]

/** Per-service sparkline series for requests, latency, and error rate. */
export interface ServiceSparklineData {
  requests: SparklinePoint[];
  latency: SparklinePoint[];
  errorRate: SparklinePoint[];
}

/**
 * Parses an ES|QL response from `buildServiceSparklineQuery` into a map
 * of service name → sparkline data.
 */
export function parseServiceSparklineData(
  result: EsqlResponse,
): Record<string, ServiceSparklineData> {
  const colIndex = new Map<string, number>();
  for (let i = 0; i < result.columns.length; i++) {
    colIndex.set(result.columns[i]!.name, i);
  }
  const get = (row: unknown[], field: string): unknown => {
    const idx = colIndex.get(field);
    return idx !== undefined ? row[idx] : null;
  };

  const toFinite = (value: unknown, fallback = 0): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const map = Object.create(null) as Record<string, ServiceSparklineData>;
  for (const row of result.values) {
    const service = String(get(row, "service.name") ?? "unknown");
    const tsRaw = get(row, "bucket");
    const ts = tsRaw ? new Date(tsRaw as string).getTime() : null;
    if (ts === null || !Number.isFinite(ts)) continue;
    if (!map[service]) {
      map[service] = { requests: [], latency: [], errorRate: [] };
    }
    const entry = map[service]!;
    entry.requests.push([ts, toFinite(get(row, "request_count"))]);
    entry.latency.push([ts, toFinite(get(row, "avg_latency_ms"))]);
    entry.errorRate.push([ts, toFinite(get(row, "error_rate"))]);
  }
  return map;
}

/* ────── Actionable insights derived from service data ────── */

export type InsightSeverity = "info" | "warning" | "error";
export type InsightIcon = "speed" | "error" | "trending";

export interface ServiceInsight {
  label: string;
  description: string;
  severity: InsightSeverity;
  icon: InsightIcon;
}

export function deriveServiceInsights(serviceRows: ServiceRow[]): ServiceInsight[] {
  if (serviceRows.length === 0) return [];

  const insights: ServiceInsight[] = [];

  const slowest = serviceRows.reduce((prev, curr) =>
    curr.avgLatencyMs > prev.avgLatencyMs ? curr : prev,
  );
  if (slowest.avgLatencyMs > 0) {
    insights.push({
      label: "Slowest Service",
      description: `${slowest.serviceName} has the highest average latency at ${formatLatency(slowest.avgLatencyMs)}. Consider investigating its slowest transactions.`,
      severity: slowest.avgLatencyMs >= 1000 ? "warning" : "info",
      icon: "speed",
    });
  }

  const highestError = serviceRows.reduce((prev, curr) =>
    curr.errorRate > prev.errorRate ? curr : prev,
  );
  if (highestError.errorRate > 0) {
    insights.push({
      label: "Highest Error Rate",
      description: `${highestError.serviceName} has an error rate of ${formatErrorRate(highestError.errorRate)}${highestError.topError !== "—" ? ` — top error: ${highestError.topError}` : ""}.`,
      severity: highestError.errorRate > 0.05 ? "error" : "warning",
      icon: "error",
    });
  }

  const mostActive = serviceRows.reduce((prev, curr) =>
    curr.requestCount > prev.requestCount ? curr : prev,
  );
  if (mostActive.requestCount > 0) {
    insights.push({
      label: "Most Active Service",
      description: `${mostActive.serviceName} leads with ${mostActive.requestCount.toLocaleString()} requests. Ensure it has adequate resources and scaling.`,
      severity: "info",
      icon: "trending",
    });
  }

  return insights;
}

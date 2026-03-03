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

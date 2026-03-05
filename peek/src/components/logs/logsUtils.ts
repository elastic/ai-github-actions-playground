export type LogsViewMode = "lines" | "chart" | "patterns";
export type ExtractMethod = "DISSECT" | "GROK";

export interface HistogramBucket {
  start: number;
  end: number;
  count: number;
  anomaly: boolean;
}

export const SIDEBAR_FIELDS = ["service.name", "log.level", "host.name", "event.dataset"];
export const TRACE_ID_FIELD = "trace.id";
export const MESSAGE_FIELD = "message";
export const TIMESTAMP_FIELD = "@timestamp";
export const HISTOGRAM_INTERVAL_MS = 5 * 60 * 1000;

export function normalizePattern(message: string): string {
  return message
    .replace(/\b\d+\b/g, "{n}")
    .replace(/\b[0-9a-f]{8,}\b/gi, "{hex}")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "{ip}")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractFieldNames(method: ExtractMethod, pattern: string): string[] {
  if (method === "DISSECT") {
    return Array.from(pattern.matchAll(/%\{([a-zA-Z0-9_.-]+)\}/g), (m) => m[1] ?? "").filter(
      Boolean,
    );
  }
  return Array.from(
    pattern.matchAll(/%\{[A-Z0-9_]+(?::([a-zA-Z0-9_.-]+)(?::[a-zA-Z0-9_]+)?)?\}/g),
    (m) => m[1] ?? "",
  ).filter(Boolean);
}

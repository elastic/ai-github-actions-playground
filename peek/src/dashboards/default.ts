import type { DashboardDefinition } from "../types";
import { DEFAULT_REFRESH_INTERVAL } from "../types";

export function createDefaultDashboard(): DashboardDefinition {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "Default",
    description: "Overview of logs, metrics, and traces with key operational stats.",
    panels: [
      // ── Row 0: Stat panels ──────────────────────────────────────────────
      {
        id: crypto.randomUUID(),
        title: "Logs",
        query: "FROM logs-* | STATS logs = COUNT(*)",
        visualization: "stat",
        layout: { x: 0, y: 0, w: 4, h: 2 },
      },
      {
        id: crypto.randomUUID(),
        title: "Metrics",
        query: "FROM metrics-* | STATS metrics = COUNT(*)",
        visualization: "stat",
        layout: { x: 4, y: 0, w: 4, h: 2 },
      },
      {
        id: crypto.randomUUID(),
        title: "Traces",
        query: "FROM traces-* | STATS traces = COUNT(*)",
        visualization: "stat",
        layout: { x: 8, y: 0, w: 4, h: 2 },
      },
      // ── Row 2: Total volume over time ────────────────────────────────────
      {
        id: crypto.randomUUID(),
        title: "Total Volume",
        query:
          "FROM * | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend | STATS doc_count = COUNT(*) BY time_bucket = BUCKET(@timestamp, 50, ?_tstart, ?_tend), `data_stream.type` | SORT time_bucket ASC",
        visualization: "timeseries",
        layout: { x: 0, y: 2, w: 12, h: 5 },
        options: { showArea: true, stacked: true },
      },
      // ── Row 7: Breakdown charts ──────────────────────────────────────────
      {
        id: crypto.randomUUID(),
        title: "Volume by Type",
        query: "FROM * | STATS doc_count = COUNT(*) BY `data_stream.type`",
        visualization: "pie",
        layout: { x: 0, y: 7, w: 4, h: 5 },
      },
      {
        id: crypto.randomUUID(),
        title: "Top 10 Data Streams",
        query:
          "FROM * | STATS doc_count = COUNT(*) BY `data_stream.dataset` | SORT doc_count DESC | LIMIT 10",
        visualization: "bar",
        layout: { x: 4, y: 7, w: 8, h: 5 },
      },
      // ── Row 12: Per-type volume over time ────────────────────────────────
      {
        id: crypto.randomUUID(),
        title: "Log Volume",
        query:
          "FROM logs-* | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend | STATS doc_count = COUNT(*) BY time_bucket = BUCKET(@timestamp, 50, ?_tstart, ?_tend) | SORT time_bucket ASC",
        visualization: "timeseries",
        layout: { x: 0, y: 12, w: 4, h: 5 },
        options: { showArea: true },
      },
      {
        id: crypto.randomUUID(),
        title: "Metric Volume",
        query:
          "FROM metrics-* | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend | STATS doc_count = COUNT(*) BY time_bucket = BUCKET(@timestamp, 50, ?_tstart, ?_tend) | SORT time_bucket ASC",
        visualization: "timeseries",
        layout: { x: 4, y: 12, w: 4, h: 5 },
        options: { showArea: true },
      },
      {
        id: crypto.randomUUID(),
        title: "Trace Volume",
        query:
          "FROM traces-* | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend | STATS doc_count = COUNT(*) BY time_bucket = BUCKET(@timestamp, 50, ?_tstart, ?_tend) | SORT time_bucket ASC",
        visualization: "timeseries",
        layout: { x: 8, y: 12, w: 4, h: 5 },
        options: { showArea: true },
      },
    ],
    timeRange: { from: "now-1h", to: "now" },
    refreshInterval: DEFAULT_REFRESH_INTERVAL,
    createdAt: now,
    updatedAt: now,
  };
}

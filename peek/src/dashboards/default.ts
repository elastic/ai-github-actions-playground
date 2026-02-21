import type { DashboardDefinition } from "../types";
import { DEFAULT_REFRESH_INTERVAL } from "../types";

export function createDefaultDashboard(): DashboardDefinition {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "Default",
    description: "Overview of logs, metrics, and traces with key operational stats.",
    panels: [
      {
        id: crypto.randomUUID(),
        title: "Log Volume",
        query:
          "FROM logs-* | STATS doc_count = COUNT(*) BY time_bucket = BUCKET(@timestamp, 50, ?_tstart, ?_tend) | SORT time_bucket ASC",
        visualization: "timeseries",
        layout: { x: 0, y: 0, w: 12, h: 5 },
      },
      {
        id: crypto.randomUUID(),
        title: "Metric Volume",
        query:
          "FROM metrics-* | STATS doc_count = COUNT(*) BY time_bucket = BUCKET(@timestamp, 50, ?_tstart, ?_tend) | SORT time_bucket ASC",
        visualization: "timeseries",
        layout: { x: 0, y: 5, w: 6, h: 5 },
      },
      {
        id: crypto.randomUUID(),
        title: "Trace Volume",
        query:
          "FROM traces-* | STATS doc_count = COUNT(*) BY time_bucket = BUCKET(@timestamp, 50, ?_tstart, ?_tend) | SORT time_bucket ASC",
        visualization: "timeseries",
        layout: { x: 6, y: 5, w: 6, h: 5 },
      },
      {
        id: crypto.randomUUID(),
        title: "Documents by Dataset",
        query:
          "FROM logs-*,metrics-*,traces-* | STATS doc_count = COUNT(*) BY `data_stream.dataset` | SORT doc_count DESC | LIMIT 20",
        visualization: "bar",
        layout: { x: 0, y: 10, w: 8, h: 5 },
      },
      {
        id: crypto.randomUUID(),
        title: "Unique Shippers",
        query: "FROM logs-*,metrics-*,traces-* | STATS unique_shippers = COUNT_DISTINCT(agent.id)",
        visualization: "stat",
        layout: { x: 8, y: 10, w: 4, h: 5 },
      },
    ],
    timeRange: { from: "now-1h", to: "now" },
    refreshInterval: DEFAULT_REFRESH_INTERVAL,
    createdAt: now,
    updatedAt: now,
  };
}

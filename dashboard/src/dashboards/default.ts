import type { DashboardDefinition } from "../types";

export function createDefaultDashboard(): DashboardDefinition {
  return {
    id: crypto.randomUUID(),
    title: "Default",
    description: "Overview of logs, metrics, and traces with key operational stats.",
    panels: [
      {
        id: crypto.randomUUID(),
        title: "Logs Over Time",
        query:
          "FROM logs-* | STATS count = COUNT(*) BY bucket = DATE_TRUNC(5 minutes, @timestamp) | SORT bucket | LIMIT 100",
        visualization: "timeseries",
        layout: { x: 0, y: 0, w: 12, h: 5 },
      },
      {
        id: crypto.randomUUID(),
        title: "Metrics Over Time",
        query:
          "FROM metrics-* | STATS count = COUNT(*) BY bucket = DATE_TRUNC(5 minutes, @timestamp) | SORT bucket | LIMIT 100",
        visualization: "timeseries",
        layout: { x: 0, y: 5, w: 6, h: 5 },
      },
      {
        id: crypto.randomUUID(),
        title: "Traces Over Time",
        query:
          "FROM traces-* | STATS count = COUNT(*) BY bucket = DATE_TRUNC(5 minutes, @timestamp) | SORT bucket | LIMIT 100",
        visualization: "timeseries",
        layout: { x: 6, y: 5, w: 6, h: 5 },
      },
      {
        id: crypto.randomUUID(),
        title: "Documents by Data Stream",
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

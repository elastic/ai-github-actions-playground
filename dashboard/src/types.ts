export interface ElasticsearchConnection {
  url: string;
  apiKey: string;
  cloudId?: string;
}

export type VisualizationType = "timeseries" | "bar" | "table" | "stat" | "gauge" | "pie";

export interface PanelDefinition {
  id: string;
  title: string;
  query: string;
  visualization: VisualizationType;
  /** Grid layout position */
  layout: { x: number; y: number; w: number; h: number };
  /** Visualization-specific options */
  options?: Record<string, unknown>;
  /** Auto-refresh interval in seconds, 0 = disabled */
  refreshInterval?: number;
}

export interface DashboardDefinition {
  id: string;
  title: string;
  description?: string;
  panels: PanelDefinition[];
  timeRange: TimeRange;
  /** Auto-refresh interval in seconds, 0 = disabled */
  refreshInterval?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimeRange {
  from: string;
  to: string;
}

/** Default auto-refresh interval in seconds */
export const DEFAULT_REFRESH_INTERVAL = 15;

export interface EsqlColumn {
  name: string;
  type: string;
}

export interface EsqlResponse {
  columns: EsqlColumn[];
  values: unknown[][];
}

export interface EsqlError {
  status: number;
  message: string;
  cause?: string;
}

export type QueryResult =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: EsqlResponse; executionTimeMs: number }
  | { status: "error"; error: EsqlError };

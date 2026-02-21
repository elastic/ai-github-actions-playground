import type { FormatOptions } from "@perses-dev/core";

export type { FormatOptions };

export interface ElasticsearchConnection {
  url: string;
  apiKey: string;
  cloudId?: string;
}

export type VisualizationType = "timeseries" | "bar" | "table" | "stat" | "gauge" | "pie";

export interface TimeSeriesOptions {
  format?: FormatOptions;
  smooth?: boolean;
  showArea?: boolean;
  stacked?: boolean;
}

export interface BarChartOptions {
  format?: FormatOptions;
  stacked?: boolean;
  horizontal?: boolean;
}

export interface StatPanelOptions {
  format?: FormatOptions;
}

export interface GaugePanelOptions {
  format?: FormatOptions;
  min?: number;
  max?: number;
}

export type VisualizationOptions =
  | TimeSeriesOptions
  | BarChartOptions
  | StatPanelOptions
  | GaugePanelOptions;

export interface PanelDefinition {
  id: string;
  title: string;
  query: string;
  visualization: VisualizationType;
  /** Grid layout position */
  layout: { x: number; y: number; w: number; h: number };
  /** Visualization-specific options */
  options?: VisualizationOptions;
  /** Auto-refresh interval in seconds, 0 = disabled */
  refreshInterval?: number;
}

export interface DashboardDefinition {
  id: string;
  title: string;
  description?: string;
  panels: PanelDefinition[];
  timeRange: TimeRange;
  createdAt: string;
  updatedAt: string;
}

export interface TimeRange {
  from: string;
  to: string;
}

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

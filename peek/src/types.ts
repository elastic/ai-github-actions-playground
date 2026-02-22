import type { FormatOptions } from "@perses-dev/core";
import type { EsqlResponse, EsqlError } from "./services/es";

export type { FormatOptions };

// ES-specific types are now sourced from the generated OpenAPI types.
export type { ElasticsearchConnection, EsqlColumn, EsqlResponse, EsqlError } from "./services/es";

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

export interface PieChartOptions {
  format?: FormatOptions;
}

export type VisualizationOptions =
  | TimeSeriesOptions
  | BarChartOptions
  | StatPanelOptions
  | GaugePanelOptions
  | PieChartOptions;

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

export type QueryResult =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: EsqlResponse; executionTimeMs: number }
  | { status: "error"; error: EsqlError };

export type LlmProvider = "openai" | "anthropic" | "google";

export interface LlmSettings {
  provider: LlmProvider;
  model: string;
  apiKey: string;
}

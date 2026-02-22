import type { FormatOptions } from "@perses-dev/core";
import type { EsqlResponse, EsqlError } from "./services/es";

export type { FormatOptions };

// ES-specific types are now sourced from the generated OpenAPI types.
export type { ElasticsearchConnection, EsqlColumn, EsqlResponse, EsqlError } from "./services/es";

export interface ConnectionProfile {
  id: string;
  name: string;
  connection: ElasticsearchConnection;
}

export type VisualizationType =
  | "timeseries"
  | "bar"
  | "table"
  | "stat"
  | "gauge"
  | "pie"
  | "heatmap"
  | "scatter"
  | "histogram";

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

export interface HeatmapChartOptions {
  format?: FormatOptions;
}

export interface ScatterChartOptions {
  format?: FormatOptions;
}

export interface HistogramChartOptions {
  format?: FormatOptions;
  bins?: number;
}

export type VisualizationOptions =
  | TimeSeriesOptions
  | BarChartOptions
  | StatPanelOptions
  | GaugePanelOptions
  | PieChartOptions
  | HeatmapChartOptions
  | ScatterChartOptions
  | HistogramChartOptions;

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

/** How a dashboard parameter gets its selectable values. */
export type ParameterSource =
  | { mode: "text" }
  | { mode: "options"; values: string[] }
  | { mode: "esql"; query: string };

/** A user-defined dashboard variable referenced as `?name` in ES|QL queries. */
export interface DashboardParameter {
  /** Identifier used in ES|QL queries (e.g. `service` → `?service`). */
  name: string;
  /** Human-readable label shown in the parameter bar. */
  label: string;
  /** ES|QL parameter type. */
  type: "keyword" | "number" | "boolean" | "date";
  /** How values are provided. */
  source: ParameterSource;
  /** Current value of the parameter. */
  value: string | number | boolean;
}

export interface DashboardDefinition {
  id: string;
  title: string;
  description?: string;
  panels: PanelDefinition[];
  /** Dashboard-level named parameters reusable across all panel queries. */
  parameters?: DashboardParameter[];
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

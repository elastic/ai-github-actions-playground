import type { FormatOptions } from "@perses-dev/core";
import type { z } from "zod";

import type {
  dashboardDefinitionSchema,
  panelDefinitionSchema,
  visualizationTypeSchema,
} from "./schemas";
import type { ElasticsearchConnection, EsqlResponse, EsqlError } from "./services/es";

export type { FormatOptions };

// ES-specific types are now sourced from the generated OpenAPI types.
export type { ElasticsearchConnection, EsqlColumn, EsqlResponse, EsqlError } from "./services/es";

export interface ConnectionProfile {
  id: string;
  name: string;
  connection: ElasticsearchConnection;
  /** When true, credentials are stored encrypted (AES-GCM) in localStorage and must be unlocked with a PIN each session. */
  encrypted?: boolean;
}

export type ProfileHealthStatus = "healthy" | "needs_attention" | "unknown";

export interface ProfileHealth {
  status: ProfileHealthStatus;
  checkedAt: string | null;
  errorSummary: string | null;
}

export type VisualizationType = z.infer<typeof visualizationTypeSchema>;

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

/** Semantic color used for threshold steps and base coloring */
export type ThresholdColor = "success" | "warning" | "error";

/** A single threshold boundary: value is the cutoff, color is applied when value >= this cutoff */
export interface ThresholdStep {
  value: number;
  color: ThresholdColor;
}

/**
 * Threshold rules for a visualization.
 * Steps are evaluated in ascending order; the highest matching step's color wins.
 * baseColor is used when the value is below all step values.
 */
export interface Thresholds {
  steps: ThresholdStep[];
  baseColor?: ThresholdColor;
}

export interface StatPanelOptions {
  format?: FormatOptions;
  thresholds?: Thresholds;
}

export interface GaugePanelOptions {
  format?: FormatOptions;
  min?: number;
  max?: number;
  thresholds?: Thresholds;
}

export interface TablePanelOptions {
  /** Column names for which threshold highlighting is applied; if omitted, all numeric columns */
  thresholdColumns?: string[];
  thresholds?: Thresholds;
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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MarkdownOptions {}

export type VisualizationOptions =
  | TimeSeriesOptions
  | BarChartOptions
  | StatPanelOptions
  | GaugePanelOptions
  | TablePanelOptions
  | PieChartOptions
  | HeatmapChartOptions
  | ScatterChartOptions
  | HistogramChartOptions
  | MarkdownOptions;

type InferredPanelDefinition = z.infer<typeof panelDefinitionSchema>;
export type PanelDefinition = Omit<InferredPanelDefinition, "options"> & {
  /** Visualization-specific options */
  options?: VisualizationOptions;
};

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

type InferredDashboardDefinition = z.infer<typeof dashboardDefinitionSchema>;
export type DashboardDefinition = Omit<InferredDashboardDefinition, "panels"> & {
  panels: PanelDefinition[];
  tags?: string[];
  archived?: boolean;
  preferredProfileId?: string;
};

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

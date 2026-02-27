import type { FormatOptions } from "@perses-dev/core";

import type { ThresholdColor } from "../contracts/dashboard/literals";

export type { FormatOptions };

export type { ThresholdColor };

export type VisualizationType =
  | "timeseries"
  | "bar"
  | "table"
  | "stat"
  | "gauge"
  | "pie"
  | "heatmap"
  | "scatter"
  | "histogram"
  | "markdown";

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

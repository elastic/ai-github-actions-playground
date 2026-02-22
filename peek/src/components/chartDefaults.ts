import type {
  BarChartOptions,
  GaugePanelOptions,
  HeatmapChartOptions,
  HistogramChartOptions,
  ScatterChartOptions,
  StatPanelOptions,
  TimeSeriesOptions,
  VisualizationOptions,
  VisualizationType,
} from "../types";

export function defaultOptions(vizType: VisualizationType): VisualizationOptions {
  switch (vizType) {
    case "timeseries":
      return { smooth: true, showArea: true, stacked: false } satisfies TimeSeriesOptions;
    case "bar":
      return { stacked: false, horizontal: false } satisfies BarChartOptions;
    case "stat":
      return {} satisfies StatPanelOptions;
    case "gauge":
      return {} satisfies GaugePanelOptions;
    case "table":
      return {};
    case "pie":
      return {};
    case "heatmap":
      return {} satisfies HeatmapChartOptions;
    case "scatter":
      return {} satisfies ScatterChartOptions;
    case "histogram":
      return { bins: 10 } satisfies HistogramChartOptions;
    default:
      throw new Error(`Unsupported visualization type: ${vizType}`);
  }
}

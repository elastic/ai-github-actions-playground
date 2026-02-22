import type {
  BarChartOptions,
  GaugePanelOptions,
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
    default:
      // "table" and "pie" have no customization options
      return {} satisfies StatPanelOptions;
  }
}

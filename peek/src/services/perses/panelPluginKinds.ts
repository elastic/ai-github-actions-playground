import type { VisualizationType } from "../../types";

const VISUALIZATION_TO_PANEL_KIND: Record<VisualizationType, string> = {
  timeseries: "TimeSeriesChart",
  stat: "StatChart",
  gauge: "GaugeChart",
  bar: "BarChart",
  table: "TablePanel",
  pie: "PieChart",
  scatter: "ScatterChart",
  heatmap: "HeatMapChart",
  histogram: "HistogramChart",
  markdown: "MarkdownPanel",
};

const PANEL_KIND_TO_VISUALIZATION: Record<string, VisualizationType> = Object.fromEntries(
  Object.entries(VISUALIZATION_TO_PANEL_KIND).map(([visualization, kind]) => [
    kind,
    visualization as VisualizationType,
  ]),
) as Record<string, VisualizationType>;

export function getPersesPanelPluginKind(visualization: VisualizationType): string {
  return VISUALIZATION_TO_PANEL_KIND[visualization];
}

export function getVisualizationTypeForPersesPanelKind(
  kind: string | undefined,
): VisualizationType | undefined {
  if (!kind) {
    return undefined;
  }
  return PANEL_KIND_TO_VISUALIZATION[kind] ?? (kind as VisualizationType);
}

import type { VisualizationType } from "../../types";
import type { VizRegistryEntry } from "../visualizations/vizRegistry";
import { getPersesPanelPluginKind } from "../../services/perses/panelPluginKinds";

const IMAGE_EXPORT_KINDS = new Set([
  "TimeSeriesChart",
  "BarChart",
  "GaugeChart",
  "PieChart",
  "ScatterChart",
  "HeatMapChart",
  "HistogramChart",
]);

export interface PersesPanelEntry {
  kind: string;
  type: VisualizationType;
  label: string;
  icon: React.ReactElement;
  supportsOptions: boolean;
  supportsQuery: boolean;
  supportsImageExport: boolean;
  defaultOptions: VizRegistryEntry["defaultOptions"];
  renderPanel: VizRegistryEntry["renderComponent"];
  OptionsEditor?: VizRegistryEntry["OptionsEditor"];
}

const panelRegistryModules = import.meta.glob<{
  default: { order: number; entry: VizRegistryEntry };
}>("../visualizations/registry/*.tsx", { eager: true });

const persesPanelEntries: PersesPanelEntry[] = Object.values(panelRegistryModules)
  .map((module) => module.default)
  .sort((a, b) => a.order - b.order)
  .map((descriptor) => {
    const entry = descriptor.entry;
    const kind = getPersesPanelPluginKind(entry.type);
    return {
      kind,
      type: entry.type,
      label: entry.label,
      icon: entry.icon,
      supportsOptions: entry.supportsOptions,
      supportsQuery: entry.supportsQuery,
      supportsImageExport: IMAGE_EXPORT_KINDS.has(kind),
      defaultOptions: entry.defaultOptions,
      renderPanel: entry.renderComponent,
      OptionsEditor: entry.OptionsEditor,
    };
  });

if (persesPanelEntries.length === 0) {
  throw new Error("Perses panel registry is empty.");
}

export const PERSES_PANEL_TYPES = persesPanelEntries.map((entry) => entry.type) as [
  VisualizationType,
  ...VisualizationType[],
];

export function getPersesPanelEntry(type: VisualizationType): PersesPanelEntry | undefined {
  return getPersesPanelEntryByPluginKind(getPersesPanelPluginKind(type));
}

export function getPersesPanelEntryByPluginKind(kind: string): PersesPanelEntry | undefined {
  return persesPanelEntries.find((entry) => entry.kind === kind);
}

export function getAllPersesPanelEntries(): readonly PersesPanelEntry[] {
  return persesPanelEntries;
}

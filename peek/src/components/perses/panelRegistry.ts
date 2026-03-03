import type {
  DashboardParameter,
  ElasticsearchConnection,
  EsqlResponse,
  TimeRange,
  VisualizationOptions,
  VisualizationType,
} from "../../types";
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
  defaultOptions: () => VisualizationOptions;
  renderPanel: (props: PersesPanelRendererProps) => React.ReactElement | null;
  OptionsEditor?: React.ComponentType<PersesPanelOptionsEditorProps>;
}

export interface PersesPanelRendererProps {
  data: EsqlResponse;
  options?: VisualizationOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
  onExportCsv?: () => void;
  query?: string;
  connection?: ElasticsearchConnection | null;
  timeRange?: TimeRange;
  parameters?: DashboardParameter[];
  /** Dashboard timezone (IANA zone or undefined for browser local). */
  timeZone?: string;
}

export interface PersesPanelOptionsEditorProps {
  options: VisualizationOptions;
  onChange: (o: VisualizationOptions) => void;
}

interface PersesPanelRegistrySourceEntry {
  type: VisualizationType;
  label: string;
  icon: React.ReactElement;
  supportsOptions: boolean;
  supportsQuery: boolean;
  defaultOptions: () => VisualizationOptions;
  renderComponent: (props: PersesPanelRendererProps) => React.ReactElement | null;
  OptionsEditor?: React.ComponentType<PersesPanelOptionsEditorProps>;
}

const panelRegistryModules = import.meta.glob<{
  default: { order: number; entry: PersesPanelRegistrySourceEntry };
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

export function getPersesPanelRendererByPluginKind(
  kind: string,
): PersesPanelEntry["renderPanel"] | undefined {
  return getPersesPanelEntryByPluginKind(kind)?.renderPanel;
}

export function getPersesPanelCapabilities(type: VisualizationType): {
  supportsOptions: boolean;
  supportsQuery: boolean;
  supportsImageExport: boolean;
  OptionsEditor?: React.ComponentType<PersesPanelOptionsEditorProps>;
} {
  const entry = getPersesPanelEntry(type);
  return {
    supportsOptions: entry?.supportsOptions ?? false,
    supportsQuery: entry?.supportsQuery ?? true,
    supportsImageExport: entry?.supportsImageExport ?? false,
    OptionsEditor: entry?.OptionsEditor,
  };
}

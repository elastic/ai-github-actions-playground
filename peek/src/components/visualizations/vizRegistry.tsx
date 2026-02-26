import type {
  DashboardParameter,
  ElasticsearchConnection,
  EsqlResponse,
  TimeRange,
  VisualizationOptions,
  VisualizationType,
} from "../../types";

export interface VizRendererProps {
  data: EsqlResponse;
  options?: VisualizationOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
  onExportCsv?: () => void;
  /**
   * Emitted when the user clicks a value in the visualization to apply a
   * cross-panel filter. `field` is the column/dimension name; `value` is the
   * string representation of the clicked value.
   */
  onFilterIntent?: (field: string, value: string) => void;
  query?: string;
  connection?: ElasticsearchConnection | null;
  timeRange?: TimeRange;
  parameters?: DashboardParameter[];
  /** Dashboard timezone (IANA zone or undefined for browser local). */
  timeZone?: string;
}

export interface VizOptionsEditorProps {
  options: VisualizationOptions;
  onChange: (o: VisualizationOptions) => void;
}

export interface VizRegistryEntry {
  type: VisualizationType;
  label: string;
  icon: React.ReactElement;
  supportsOptions: boolean;
  supportsQuery: boolean;
  defaultOptions(): VisualizationOptions;
  renderComponent(props: VizRendererProps): React.ReactElement | null;
  OptionsEditor?: React.ComponentType<VizOptionsEditorProps>;
}

export interface VizRegistryDescriptor {
  order: number;
  entry: VizRegistryEntry;
}

const registryModules = import.meta.glob<{ default: VizRegistryDescriptor }>("./registry/*.tsx", {
  eager: true,
});

const vizRegistryEntries = Object.values(registryModules)
  .map((module) => module.default)
  .sort((a, b) => a.order - b.order)
  .map((descriptor) => descriptor.entry);

if (vizRegistryEntries.length === 0) {
  throw new Error("Visualization registry is empty.");
}

export const VISUALIZATION_TYPES = vizRegistryEntries.map((entry) => entry.type) as [
  VisualizationType,
  ...VisualizationType[],
];

export function getVizEntry(type: VisualizationType): VizRegistryEntry | undefined {
  return vizRegistryEntries.find((entry) => entry.type === type);
}

export function getAllVizEntries(): readonly VizRegistryEntry[] {
  return vizRegistryEntries;
}

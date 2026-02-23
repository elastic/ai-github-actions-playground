/**
 * Visualization registry — single source of truth for all visualization types.
 *
 * Each entry captures the type key, display metadata (label + icon), default
 * options factory, renderer component, and an optional type-specific options
 * editor.  Adding a new visualization only requires adding one entry here plus
 * its implementation file; no other files need edits.
 */

import BarChartIcon from "@mui/icons-material/BarChart";
import EqualizerIcon from "@mui/icons-material/Equalizer";
import GridOnIcon from "@mui/icons-material/GridOn";
import NotesIcon from "@mui/icons-material/Notes";
import NumbersIcon from "@mui/icons-material/Numbers";
import PieChartIcon from "@mui/icons-material/PieChart";
import ScatterPlotIcon from "@mui/icons-material/ScatterPlot";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import SpeedIcon from "@mui/icons-material/Speed";
import TableChartIcon from "@mui/icons-material/TableChart";

import type {
  BarChartOptions,
  DashboardParameter,
  ElasticsearchConnection,
  EsqlResponse,
  GaugePanelOptions,
  HeatmapChartOptions,
  HistogramChartOptions,
  MarkdownOptions,
  PieChartOptions,
  ScatterChartOptions,
  StatPanelOptions,
  TablePanelOptions,
  TimeRange,
  TimeSeriesOptions,
  VisualizationOptions,
  VisualizationType,
} from "../../types";

import BarChart from "./BarChart";
import DataTable from "./DataTable";
import GaugePanel from "./GaugePanel";
import HeatmapChart from "./HeatmapChart";
import HistogramChart from "./HistogramChart";
import MarkdownPanel from "./MarkdownPanel";
import PieChart from "./PieChart";
import ScatterChart from "./ScatterChart";
import StatPanel from "./StatPanel";
import TimeSeriesChart from "./TimeSeriesChart";
import {
  BarChartOptionsEditor,
  GaugeOptionsEditor,
  HistogramOptionsEditor,
  StatOptionsEditor,
  TableOptionsEditor,
  TimeSeriesOptionsEditor,
} from "./vizOptionsEditors";

// ---------------------------------------------------------------------------
// Shared prop shapes
// ---------------------------------------------------------------------------

export interface VizRendererProps {
  data: EsqlResponse;
  options?: VisualizationOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
  /** Raw panel query text — used by static panels such as markdown. */
  query?: string;
  /** Elasticsearch connection — forwarded to panels that run their own queries. */
  connection?: ElasticsearchConnection | null;
  /** Dashboard time range — forwarded to embedded ES|QL queries. */
  timeRange?: TimeRange;
  /** Dashboard parameters — forwarded to embedded ES|QL queries. */
  parameters?: DashboardParameter[];
}

export interface VizOptionsEditorProps {
  options: VisualizationOptions;
  onChange: (o: VisualizationOptions) => void;
}

// ---------------------------------------------------------------------------
// Registry entry shape
// ---------------------------------------------------------------------------

export interface VizRegistryEntry {
  /** Canonical string key that matches VisualizationType. */
  type: VisualizationType;
  /** Human-readable label shown in the editor toggle. */
  label: string;
  /** Icon element shown in the editor toggle. */
  icon: React.ReactElement;
  /**
   * Whether the ChartOptionsEditor (format + type-specific controls) should
   * be displayed for this visualization type.
   */
  supportsOptions: boolean;
  /**
   * Whether this visualization type requires an ES|QL query and data fetch.
   * When `false` the panel content comes from the `query` field as raw text
   * (e.g. markdown) and no Elasticsearch request is made.
   */
  supportsQuery: boolean;
  /** Returns fresh default options for this visualization type. */
  defaultOptions(): VisualizationOptions;
  /** Renders the visualization given data and options. */
  renderComponent(props: VizRendererProps): React.ReactElement | null;
  /** Optional type-specific options UI rendered inside ChartOptionsEditor. */
  OptionsEditor?: React.ComponentType<VizOptionsEditorProps>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const vizRegistryEntries: VizRegistryEntry[] = [
  {
    type: "timeseries",
    label: "Time Series",
    icon: <ShowChartIcon />,
    supportsOptions: true,
    supportsQuery: true,
    defaultOptions: () =>
      ({ smooth: true, showArea: true, stacked: false }) satisfies TimeSeriesOptions,
    renderComponent: ({ data, options, onExportReady }) => (
      <TimeSeriesChart
        data={data}
        options={options as TimeSeriesOptions | undefined}
        onExportReady={onExportReady}
      />
    ),
    OptionsEditor: TimeSeriesOptionsEditor,
  },
  {
    type: "bar",
    label: "Bar",
    icon: <BarChartIcon />,
    supportsOptions: true,
    supportsQuery: true,
    defaultOptions: () => ({ stacked: false, horizontal: false }) satisfies BarChartOptions,
    renderComponent: ({ data, options, onExportReady }) => (
      <BarChart
        data={data}
        options={options as BarChartOptions | undefined}
        onExportReady={onExportReady}
      />
    ),
    OptionsEditor: BarChartOptionsEditor,
  },
  {
    type: "table",
    label: "Table",
    icon: <TableChartIcon />,
    supportsOptions: true,
    supportsQuery: true,
    defaultOptions: () => ({}) satisfies TablePanelOptions,
    renderComponent: ({ data, options }) => (
      <DataTable data={data} options={options as TablePanelOptions | undefined} />
    ),
    OptionsEditor: TableOptionsEditor,
  },
  {
    type: "stat",
    label: "Stat",
    icon: <NumbersIcon />,
    supportsOptions: true,
    supportsQuery: true,
    defaultOptions: () => ({}) satisfies StatPanelOptions,
    renderComponent: ({ data, options }) => (
      <StatPanel data={data} options={options as StatPanelOptions | undefined} />
    ),
    OptionsEditor: StatOptionsEditor,
  },
  {
    type: "gauge",
    label: "Gauge",
    icon: <SpeedIcon />,
    supportsOptions: true,
    supportsQuery: true,
    defaultOptions: () => ({}) satisfies GaugePanelOptions,
    renderComponent: ({ data, options, onExportReady }) => (
      <GaugePanel
        data={data}
        options={options as GaugePanelOptions | undefined}
        onExportReady={onExportReady}
      />
    ),
    OptionsEditor: GaugeOptionsEditor,
  },
  {
    type: "pie",
    label: "Pie",
    icon: <PieChartIcon />,
    supportsOptions: false,
    supportsQuery: true,
    defaultOptions: () => ({}) satisfies PieChartOptions,
    renderComponent: ({ data, onExportReady }) => (
      <PieChart data={data} onExportReady={onExportReady} />
    ),
  },
  {
    type: "heatmap",
    label: "Heatmap",
    icon: <GridOnIcon />,
    supportsOptions: false,
    supportsQuery: true,
    defaultOptions: () => ({}) satisfies HeatmapChartOptions,
    renderComponent: ({ data }) => <HeatmapChart data={data} />,
  },
  {
    type: "scatter",
    label: "Scatter",
    icon: <ScatterPlotIcon />,
    supportsOptions: true,
    supportsQuery: true,
    defaultOptions: () => ({}) satisfies ScatterChartOptions,
    renderComponent: ({ data, options }) => (
      <ScatterChart data={data} options={options as ScatterChartOptions | undefined} />
    ),
  },
  {
    type: "histogram",
    label: "Histogram",
    icon: <EqualizerIcon />,
    supportsOptions: true,
    supportsQuery: true,
    defaultOptions: () => ({ bins: 10 }) satisfies HistogramChartOptions,
    renderComponent: ({ data, options }) => (
      <HistogramChart data={data} options={options as HistogramChartOptions | undefined} />
    ),
    OptionsEditor: HistogramOptionsEditor,
  },
  {
    type: "markdown",
    label: "Markdown",
    icon: <NotesIcon />,
    supportsOptions: false,
    supportsQuery: false,
    defaultOptions: () => ({}) satisfies MarkdownOptions,
    renderComponent: ({ query, connection, timeRange, parameters }) => (
      <MarkdownPanel
        content={query ?? ""}
        connection={connection}
        timeRange={timeRange}
        parameters={parameters}
      />
    ),
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the registry entry for the given visualization type, or `undefined`
 * if the type is not registered.
 */
export function getVizEntry(type: VisualizationType): VizRegistryEntry | undefined {
  return vizRegistryEntries.find((e) => e.type === type);
}

/**
 * Returns all registered visualization entries in display order.
 */
export function getAllVizEntries(): readonly VizRegistryEntry[] {
  return vizRegistryEntries;
}

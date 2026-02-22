import type {
  VisualizationType,
  EsqlResponse,
  VisualizationOptions,
  TimeSeriesOptions,
  BarChartOptions,
  StatPanelOptions,
  GaugePanelOptions,
} from "../../types";
import TimeSeriesChart from "./TimeSeriesChart";
import BarChart from "./BarChart";
import DataTable from "./DataTable";
import StatPanel from "./StatPanel";
import GaugePanel from "./GaugePanel";
import PieChart from "./PieChart";

interface Props {
  type: VisualizationType;
  data: EsqlResponse;
  options?: VisualizationOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
}

export default function Visualization({ type, data, options, onExportReady }: Props) {
  switch (type) {
    case "timeseries":
      return (
        <TimeSeriesChart
          data={data}
          options={options as TimeSeriesOptions | undefined}
          onExportReady={onExportReady}
        />
      );
    case "bar":
      return (
        <BarChart
          data={data}
          options={options as BarChartOptions | undefined}
          onExportReady={onExportReady}
        />
      );
    case "table":
      return <DataTable data={data} />;
    case "stat":
      return <StatPanel data={data} options={options as StatPanelOptions | undefined} />;
    case "gauge":
      return (
        <GaugePanel
          data={data}
          options={options as GaugePanelOptions | undefined}
          onExportReady={onExportReady}
        />
      );
    case "pie":
      return <PieChart data={data} onExportReady={onExportReady} />;
    default:
      return <DataTable data={data} />;
  }
}

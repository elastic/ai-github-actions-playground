import type {
  VisualizationType,
  EsqlResponse,
  VisualizationOptions,
  TimeSeriesOptions,
  BarChartOptions,
  StatPanelOptions,
  GaugePanelOptions,
  ScatterChartOptions,
  HistogramChartOptions,
} from "../../types";
import TimeSeriesChart from "./TimeSeriesChart";
import BarChart from "./BarChart";
import DataTable from "./DataTable";
import StatPanel from "./StatPanel";
import GaugePanel from "./GaugePanel";
import PieChart from "./PieChart";
import HeatmapChart from "./HeatmapChart";
import ScatterChart from "./ScatterChart";
import HistogramChart from "./HistogramChart";

interface Props {
  type: VisualizationType;
  data: EsqlResponse;
  options?: VisualizationOptions;
}

export default function Visualization({ type, data, options }: Props) {
  switch (type) {
    case "timeseries":
      return <TimeSeriesChart data={data} options={options as TimeSeriesOptions | undefined} />;
    case "bar":
      return <BarChart data={data} options={options as BarChartOptions | undefined} />;
    case "table":
      return <DataTable data={data} />;
    case "stat":
      return <StatPanel data={data} options={options as StatPanelOptions | undefined} />;
    case "gauge":
      return <GaugePanel data={data} options={options as GaugePanelOptions | undefined} />;
    case "pie":
      return <PieChart data={data} />;
    case "heatmap":
      return <HeatmapChart data={data} />;
    case "scatter":
      return <ScatterChart data={data} options={options as ScatterChartOptions | undefined} />;
    case "histogram":
      return <HistogramChart data={data} options={options as HistogramChartOptions | undefined} />;
    default:
      return <DataTable data={data} />;
  }
}

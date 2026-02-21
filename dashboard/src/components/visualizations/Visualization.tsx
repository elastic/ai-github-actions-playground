import type { VisualizationType, EsqlResponse } from "../../types";
import TimeSeriesChart from "./TimeSeriesChart";
import BarChart from "./BarChart";
import DataTable from "./DataTable";
import StatPanel from "./StatPanel";
import GaugePanel from "./GaugePanel";
import PieChart from "./PieChart";

interface Props {
  type: VisualizationType;
  data: EsqlResponse;
}

export default function Visualization({ type, data }: Props) {
  switch (type) {
    case "timeseries":
      return <TimeSeriesChart data={data} />;
    case "bar":
      return <BarChart data={data} />;
    case "table":
      return <DataTable data={data} />;
    case "stat":
      return <StatPanel data={data} />;
    case "gauge":
      return <GaugePanel data={data} />;
    case "pie":
      return <PieChart data={data} />;
    default:
      return <DataTable data={data} />;
  }
}

import type {
  VisualizationType,
  EsqlResponse,
  VisualizationOptions,
  ElasticsearchConnection,
  TimeRange,
  DashboardParameter,
} from "../../types";

import DataTable from "./DataTable";
import { getVizEntry } from "./vizRegistry";

interface Props {
  type: VisualizationType;
  data: EsqlResponse;
  options?: VisualizationOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
  onExportCsv?: () => void;
  query?: string;
  connection?: ElasticsearchConnection | null;
  timeRange?: TimeRange;
  parameters?: DashboardParameter[];
}

export default function Visualization({
  type,
  data,
  options,
  onExportReady,
  onExportCsv,
  query,
  connection,
  timeRange,
  parameters,
}: Props) {
  const entry = getVizEntry(type);
  return (
    entry?.renderComponent({
      data,
      options,
      onExportReady,
      onExportCsv,
      query,
      connection,
      timeRange,
      parameters,
    }) ?? <DataTable data={data} />
  );
}

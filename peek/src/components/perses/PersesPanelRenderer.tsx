import DataTable from "../visualizations/DataTable";
import type {
  DashboardParameter,
  ElasticsearchConnection,
  EsqlResponse,
  TimeRange,
  VisualizationOptions,
  VisualizationType,
} from "../../types";

import { getPersesPanelEntry } from "./panelRegistry";

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
  timeZone?: string;
}

export default function PersesPanelRenderer({
  type,
  data,
  options,
  onExportReady,
  onExportCsv,
  query,
  connection,
  timeRange,
  parameters,
  timeZone,
}: Props) {
  const entry = getPersesPanelEntry(type);
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
      timeZone,
    }) ?? <DataTable data={data} />
  );
}

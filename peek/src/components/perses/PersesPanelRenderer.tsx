import type {
  DashboardParameter,
  ElasticsearchConnection,
  EsqlResponse,
  TimeRange,
  VisualizationOptions,
  VisualizationType,
} from "../../types";
import { getPersesPanelPluginKind } from "../../services/perses/panelPluginKinds";
import DataTable from "../visualizations/DataTable";

import { getPersesPanelRendererByPluginKind } from "./panelRegistry";

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
  /** Dashboard timezone (IANA zone or undefined for browser local). */
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
  const kind = getPersesPanelPluginKind(type);
  const renderPanel = getPersesPanelRendererByPluginKind(kind);
  if (!renderPanel) {
    return <DataTable data={data} />;
  }

  return renderPanel({
    data,
    options,
    onExportReady,
    onExportCsv,
    query,
    connection,
    timeRange,
    parameters,
    timeZone,
  });
}

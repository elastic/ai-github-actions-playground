import type { VisualizationType, EsqlResponse, VisualizationOptions } from "../../types";

import DataTable from "./DataTable";
import { getVizEntry } from "./vizRegistry";

interface Props {
  type: VisualizationType;
  data: EsqlResponse;
  options?: VisualizationOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
  query?: string;
}

export default function Visualization({ type, data, options, onExportReady, query }: Props) {
  const entry = getVizEntry(type);
  return entry?.renderComponent({ data, options, onExportReady, query }) ?? <DataTable data={data} />;
}

import type { VisualizationType, EsqlResponse, VisualizationOptions } from "../../types";

import DataTable from "./DataTable";
import { getVizEntry } from "./vizRegistry";

interface Props {
  type: VisualizationType;
  data: EsqlResponse;
  options?: VisualizationOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
}

export default function Visualization({ type, data, options, onExportReady }: Props) {
  const entry = getVizEntry(type);
  return entry?.renderComponent({ data, options, onExportReady }) ?? <DataTable data={data} />;
}

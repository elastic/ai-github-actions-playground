import TableChartIcon from "@mui/icons-material/TableChart";

import type { TablePanelOptions } from "../../../types";
import DataTable from "../DataTable";
import { TableOptionsEditor } from "../vizOptionsEditors";
import type { VizRegistryDescriptor } from "../vizRegistry";

const descriptor: VizRegistryDescriptor = {
  order: 30,
  entry: {
    type: "table",
    label: "Table",
    icon: <TableChartIcon />,
    supportsOptions: true,
    supportsQuery: true,
    defaultOptions: () => ({}) satisfies TablePanelOptions,
    renderComponent: ({ data, options, onExportCsv, onFilterIntent }) => (
      <DataTable
        data={data}
        options={options as TablePanelOptions | undefined}
        onExportCsv={onExportCsv}
        onFilterIntent={onFilterIntent}
      />
    ),
    OptionsEditor: TableOptionsEditor,
  },
};

export default descriptor;

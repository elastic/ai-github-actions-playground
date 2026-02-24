import BarChartIcon from "@mui/icons-material/BarChart";

import type { BarChartOptions } from "../../../types";
import BarChart from "../BarChart";
import { BarChartOptionsEditor } from "../vizOptionsEditors";
import type { VizRegistryDescriptor } from "../vizRegistry";

const descriptor: VizRegistryDescriptor = {
  order: 20,
  entry: {
    type: "bar",
    label: "Bar",
    icon: <BarChartIcon />,
    supportsOptions: true,
    supportsQuery: true,
    defaultOptions: () => ({ stacked: false, horizontal: false }) satisfies BarChartOptions,
    renderComponent: ({ data, options, onExportReady, onFilterIntent }) => (
      <BarChart
        data={data}
        options={options as BarChartOptions | undefined}
        onExportReady={onExportReady}
        onFilterIntent={onFilterIntent}
      />
    ),
    OptionsEditor: BarChartOptionsEditor,
  },
};

export default descriptor;

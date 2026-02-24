import PieChartIcon from "@mui/icons-material/PieChart";

import type { PieChartOptions } from "../../../types";
import PieChart from "../PieChart";
import type { VizRegistryDescriptor } from "../vizRegistry";

const descriptor: VizRegistryDescriptor = {
  order: 60,
  entry: {
    type: "pie",
    label: "Pie",
    icon: <PieChartIcon />,
    supportsOptions: false,
    supportsQuery: true,
    defaultOptions: () => ({}) satisfies PieChartOptions,
    renderComponent: ({ data, onExportReady, onFilterIntent }) => (
      <PieChart data={data} onExportReady={onExportReady} onFilterIntent={onFilterIntent} />
    ),
  },
};

export default descriptor;

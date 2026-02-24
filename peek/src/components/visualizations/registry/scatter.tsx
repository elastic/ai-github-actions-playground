import ScatterPlotIcon from "@mui/icons-material/ScatterPlot";

import type { ScatterChartOptions } from "../../../types";
import ScatterChart from "../ScatterChart";
import type { VizRegistryDescriptor } from "../vizRegistry";

const descriptor: VizRegistryDescriptor = {
  order: 80,
  entry: {
    type: "scatter",
    label: "Scatter",
    icon: <ScatterPlotIcon />,
    supportsOptions: true,
    supportsQuery: true,
    defaultOptions: () => ({}) satisfies ScatterChartOptions,
    renderComponent: ({ data, options }) => (
      <ScatterChart data={data} options={options as ScatterChartOptions | undefined} />
    ),
  },
};

export default descriptor;

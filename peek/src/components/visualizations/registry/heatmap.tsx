import GridOnIcon from "@mui/icons-material/GridOn";

import type { HeatmapChartOptions } from "../../../types";
import HeatmapChart from "../HeatmapChart";
import type { VizRegistryDescriptor } from "../vizRegistry";

const descriptor: VizRegistryDescriptor = {
  order: 70,
  entry: {
    type: "heatmap",
    label: "Heatmap",
    icon: <GridOnIcon />,
    supportsOptions: false,
    supportsQuery: true,
    defaultOptions: () => ({}) satisfies HeatmapChartOptions,
    renderComponent: ({ data, onExportReady }) => (
      <HeatmapChart data={data} onExportReady={onExportReady} />
    ),
  },
};

export default descriptor;

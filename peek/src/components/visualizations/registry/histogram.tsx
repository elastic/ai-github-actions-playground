import EqualizerIcon from "@mui/icons-material/Equalizer";

import type { HistogramChartOptions } from "../../../types";
import HistogramChart from "../HistogramChart";
import { HistogramOptionsEditor } from "../vizOptionsEditors";
import type { VizRegistryDescriptor } from "../vizRegistry";

const descriptor: VizRegistryDescriptor = {
  order: 90,
  entry: {
    type: "histogram",
    label: "Histogram",
    icon: <EqualizerIcon />,
    supportsOptions: true,
    supportsQuery: true,
    defaultOptions: () => ({ bins: 10 }) satisfies HistogramChartOptions,
    renderComponent: ({ data, options, onExportReady }) => (
      <HistogramChart
        data={data}
        options={options as HistogramChartOptions | undefined}
        onExportReady={onExportReady}
      />
    ),
    OptionsEditor: HistogramOptionsEditor,
  },
};

export default descriptor;

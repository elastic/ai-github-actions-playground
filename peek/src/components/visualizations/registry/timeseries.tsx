import ShowChartIcon from "@mui/icons-material/ShowChart";

import type { TimeSeriesOptions } from "../../../types";
import TimeSeriesChart from "../TimeSeriesChart";
import { TimeSeriesOptionsEditor } from "../vizOptionsEditors";
import type { VizRegistryDescriptor } from "../vizRegistry";

const descriptor: VizRegistryDescriptor = {
  order: 10,
  entry: {
    type: "timeseries",
    label: "Time Series",
    icon: <ShowChartIcon />,
    supportsOptions: true,
    supportsQuery: true,
    defaultOptions: () =>
      ({ smooth: true, showArea: true, stacked: false }) satisfies TimeSeriesOptions,
    renderComponent: ({ data, options, onExportReady, onFilterIntent, timeZone }) => (
      <TimeSeriesChart
        data={data}
        options={options as TimeSeriesOptions | undefined}
        onExportReady={onExportReady}
        onFilterIntent={onFilterIntent}
        timeZone={timeZone}
      />
    ),
    OptionsEditor: TimeSeriesOptionsEditor,
  },
};

export default descriptor;

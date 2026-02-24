import SpeedIcon from "@mui/icons-material/Speed";

import type { GaugePanelOptions } from "../../../types";
import GaugePanel from "../GaugePanel";
import { GaugeOptionsEditor } from "../vizOptionsEditors";
import type { VizRegistryDescriptor } from "../vizRegistry";

const descriptor: VizRegistryDescriptor = {
  order: 50,
  entry: {
    type: "gauge",
    label: "Gauge",
    icon: <SpeedIcon />,
    supportsOptions: true,
    supportsQuery: true,
    defaultOptions: () => ({}) satisfies GaugePanelOptions,
    renderComponent: ({ data, options, onExportReady }) => (
      <GaugePanel
        data={data}
        options={options as GaugePanelOptions | undefined}
        onExportReady={onExportReady}
      />
    ),
    OptionsEditor: GaugeOptionsEditor,
  },
};

export default descriptor;

import NumbersIcon from "@mui/icons-material/Numbers";

import type { StatPanelOptions } from "../../../types";
import StatPanel from "../StatPanel";
import { StatOptionsEditor } from "../vizOptionsEditors";
import type { VizRegistryDescriptor } from "../vizRegistry";

const descriptor: VizRegistryDescriptor = {
  order: 40,
  entry: {
    type: "stat",
    label: "Stat",
    icon: <NumbersIcon />,
    supportsOptions: true,
    supportsQuery: true,
    defaultOptions: () => ({}) satisfies StatPanelOptions,
    renderComponent: ({ data, options }) => (
      <StatPanel data={data} options={options as StatPanelOptions | undefined} />
    ),
    OptionsEditor: StatOptionsEditor,
  },
};

export default descriptor;

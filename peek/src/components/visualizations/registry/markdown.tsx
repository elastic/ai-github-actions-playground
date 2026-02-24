import NotesIcon from "@mui/icons-material/Notes";

import type { MarkdownOptions } from "../../../types";
import MarkdownPanel from "../MarkdownPanel";
import type { VizRegistryDescriptor } from "../vizRegistry";

const descriptor: VizRegistryDescriptor = {
  order: 100,
  entry: {
    type: "markdown",
    label: "Markdown",
    icon: <NotesIcon />,
    supportsOptions: false,
    supportsQuery: false,
    defaultOptions: () => ({}) satisfies MarkdownOptions,
    renderComponent: ({ query, connection, timeRange, parameters }) => (
      <MarkdownPanel
        content={query ?? ""}
        connection={connection}
        timeRange={timeRange}
        parameters={parameters}
      />
    ),
  },
};

export default descriptor;

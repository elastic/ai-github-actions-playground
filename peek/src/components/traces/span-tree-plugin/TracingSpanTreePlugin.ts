/**
 * Perses panel plugin definition for the span tree viewer.
 */
import type { PanelPlugin } from "@perses-dev/plugin-system";

import TracingSpanTreePanel from "./TracingSpanTreePanel";
import type { TracingSpanTreeOptions } from "./spanTreeTypes";

export const TracingSpanTree: PanelPlugin<TracingSpanTreeOptions> = {
  PanelComponent: TracingSpanTreePanel,
  supportedQueryTypes: ["TraceQuery"],
  createInitialOptions: () => ({
    visual: {
      showTimeline: true,
      autoCollapseThreshold: 3,
      defaultExpandDepth: 2,
    },
  }),
};

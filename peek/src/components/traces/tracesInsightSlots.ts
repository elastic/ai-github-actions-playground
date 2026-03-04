import type { InsightSlotDefinition } from "../../types/insightSlots";

/** Slot manifest for the Traces page. */
export const TRACES_INSIGHT_SLOTS: InsightSlotDefinition[] = [
  {
    slotId: "trace-search",
    label: "Trace search panel — query, filters, and time range",
  },
  {
    slotId: "trace-results",
    label: "Trace results view — list, scatter, timeseries, service map, drift radar",
  },
  {
    slotId: "trace-waterfall",
    label: "Trace detail panel — waterfall, span tree, span detail drawer",
  },
];

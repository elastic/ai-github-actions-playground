import type { InsightSlotDefinition } from "../../types/insightSlots";

export const TRACES_INSIGHT_SLOT_IDS = {
  traceSearch: "trace-search",
  traceResults: "trace-results",
  traceWaterfall: "trace-waterfall",
} as const;

export const TRACE_ROW_SLOT_PREFIX = "trace-row";
export const TRACE_GROUP_SLOT_PREFIX = "trace-group-row";

export function traceRowSlotId(spanId: string): string {
  return `${TRACE_ROW_SLOT_PREFIX}:${spanId}`;
}

export function traceGroupRowSlotId(groupKey: string): string {
  return `${TRACE_GROUP_SLOT_PREFIX}:${groupKey}`;
}

/** Slot manifest for the Traces page. */
export const TRACES_INSIGHT_SLOTS: InsightSlotDefinition[] = [
  {
    slotId: TRACES_INSIGHT_SLOT_IDS.traceSearch,
    label: "Trace search panel — query, filters, and time range",
  },
  {
    slotId: TRACES_INSIGHT_SLOT_IDS.traceResults,
    label: "Trace results view — list, scatter, timeseries, service map, drift radar",
  },
  {
    slotId: TRACES_INSIGHT_SLOT_IDS.traceWaterfall,
    label: "Span detail drawer for the selected trace/span",
  },
];

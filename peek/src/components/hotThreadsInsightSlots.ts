import type { InsightSlotDefinition } from "../types/insightSlots";

export const HOT_THREADS_INSIGHT_SLOT_IDS = {
  controls: "hot-threads-controls",
  resultsPanel: "hot-threads-results-panel",
  detailsDrawer: "hot-threads-details-drawer",
} as const;

export const HOT_THREADS_INSIGHT_SLOTS: readonly InsightSlotDefinition[] = [
  {
    slotId: HOT_THREADS_INSIGHT_SLOT_IDS.controls,
    label: "Hot threads controls panel (type, threads, snapshots, interval, idle toggle)",
  },
  {
    slotId: HOT_THREADS_INSIGHT_SLOT_IDS.resultsPanel,
    label: "Hot threads parsed/raw results panel",
  },
  {
    slotId: HOT_THREADS_INSIGHT_SLOT_IDS.detailsDrawer,
    label: "Selected thread details drawer with stack frames",
  },
];

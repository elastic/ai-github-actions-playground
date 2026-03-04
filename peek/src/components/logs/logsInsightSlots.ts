import type { InsightSlotDefinition } from "../../types/insightSlots";

export const LOGS_INSIGHT_SLOT_IDS = {
  logsSearch: "logs-search",
  logsResults: "logs-results",
} as const;

/** Slot manifest for the Logs page. */
export const LOGS_INSIGHT_SLOTS: InsightSlotDefinition[] = [
  {
    slotId: LOGS_INSIGHT_SLOT_IDS.logsSearch,
    label: "Log search panel — query, full-text search, and filters",
  },
  {
    slotId: LOGS_INSIGHT_SLOT_IDS.logsResults,
    label: "Log results view — data table, timeline histogram, and pattern groups",
  },
];

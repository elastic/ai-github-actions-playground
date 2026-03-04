import type { InsightSlotDefinition } from "../../types/insightSlots";

export const EXPLORE_INSIGHT_SLOT_IDS = {
  exploreSearch: "explore-search",
  exploreContent: "explore-content",
} as const;

/** Slot manifest for the Explore (Metrics) page. */
export const EXPLORE_INSIGHT_SLOTS: InsightSlotDefinition[] = [
  {
    slotId: EXPLORE_INSIGHT_SLOT_IDS.exploreSearch,
    label: "Metrics search panel — metric selection, aggregation, filters, and group-by",
  },
  {
    slotId: EXPLORE_INSIGHT_SLOT_IDS.exploreContent,
    label: "Metrics content area — chart visualization, dimension overview, and metric overview",
  },
];

import { useContext } from "react";

import type { SlotInsight } from "../types/insightSlots";

import { InsightSlotCtx } from "./InsightSlotContext";

/**
 * Returns the insight for a specific slot, or `null` if no insight has been
 * generated for that slot yet.
 */
export function useSlotInsight(slotId: string): SlotInsight | null {
  const { insightsBySlot } = useContext(InsightSlotCtx);
  return insightsBySlot.get(slotId) ?? null;
}

/**
 * Returns the full context value for advanced consumers that need loading /
 * error / summary information in addition to individual slot insights.
 */
export function useInsightSlotContext() {
  return useContext(InsightSlotCtx);
}

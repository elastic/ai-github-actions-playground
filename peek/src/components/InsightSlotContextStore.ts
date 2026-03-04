import { createContext } from "react";

import type { SlotInsight } from "../types/insightSlots";

export interface InsightSlotContextValue {
  /** High-level page summary from the LLM. */
  summary: string | null;
  /** Map of slotId → SlotInsight for O(1) lookup. */
  insightsBySlot: ReadonlyMap<string, SlotInsight>;
  /** Whether the LLM call is in progress. */
  loading: boolean;
  /** Error message if the call failed. */
  error: string | null;
  /** Trigger a refresh of all slot insights. */
  refresh: () => void;
}

export const InsightSlotCtx = createContext<InsightSlotContextValue>({
  summary: null,
  insightsBySlot: new Map(),
  loading: false,
  error: null,
  refresh: () => {},
});

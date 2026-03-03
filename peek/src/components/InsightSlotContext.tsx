import React, { createContext, useContext, useMemo } from "react";

import type { SlotInsight } from "../types/insightSlots";

interface InsightSlotContextValue {
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

const InsightSlotCtx = createContext<InsightSlotContextValue>({
  summary: null,
  insightsBySlot: new Map(),
  loading: false,
  error: null,
  refresh: () => {},
});

export interface InsightSlotProviderProps {
  summary: string | null;
  insights: SlotInsight[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  children: React.ReactNode;
}

/**
 * Provides page-level slot insights to the component tree.
 *
 * Wrap a page component with this provider and pass the result of
 * `usePageSlotInsights`.  Children consume individual slot insights
 * via `useSlotInsight(slotId)`.
 */
export function InsightSlotProvider({
  summary,
  insights,
  loading,
  error,
  refresh,
  children,
}: InsightSlotProviderProps) {
  const insightsBySlot = useMemo(() => {
    const map = new Map<string, SlotInsight>();
    for (const insight of insights) {
      map.set(insight.slotId, insight);
    }
    return map;
  }, [insights]);

  const value = useMemo<InsightSlotContextValue>(
    () => ({ summary, insightsBySlot, loading, error, refresh }),
    [summary, insightsBySlot, loading, error, refresh],
  );

  return React.createElement(InsightSlotCtx.Provider, { value }, children);
}

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
export function useInsightSlotContext(): InsightSlotContextValue {
  return useContext(InsightSlotCtx);
}

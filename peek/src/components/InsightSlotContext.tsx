import React, { useMemo, useEffect } from "react";

import type { SlotInsight } from "../types/insightSlots";
import { useInsightStatusStore } from "../store/useInsightStatusStore";

import { InsightSlotCtx } from "./InsightSlotContextStore";
import type { InsightSlotContextValue } from "./InsightSlotContextStore";

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
 *
 * Also syncs insight status to the global {@link useInsightStatusStore}
 * so that the footer status indicator can display loading progress and
 * insight counts without needing direct access to page-level context.
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

  // Sync page-level insight status to the global store for the footer.
  const syncFromProvider = useInsightStatusStore((s) => s.syncFromProvider);
  useEffect(() => {
    syncFromProvider({ loading, totalInsights: insights.length, error });
  }, [syncFromProvider, loading, insights.length, error]);

  // Clear global status on unmount (page navigation).
  const resetInsightStatus = useInsightStatusStore((s) => s.resetInsightStatus);
  useEffect(() => {
    return () => {
      resetInsightStatus();
    };
  }, [resetInsightStatus]);

  return React.createElement(InsightSlotCtx.Provider, { value }, children);
}

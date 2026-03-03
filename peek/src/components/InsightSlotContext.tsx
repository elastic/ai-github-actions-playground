import React, { useMemo } from "react";

import type { SlotInsight } from "../types/insightSlots";

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

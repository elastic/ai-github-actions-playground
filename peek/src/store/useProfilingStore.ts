import { create } from "zustand";

import type { ProfilingFilters } from "../components/profiling/profilingQueryBuilder";
import { EMPTY_FILTERS } from "../components/profiling/profilingQueryBuilder";

export type ProfilingViewMode =
  | "topFunctions"
  | "stacktraces"
  | "timeline"
  | "flamegraph"
  | "flamescope";

interface ProfilingState {
  filters: ProfilingFilters;
  rawQuery: string | null;
  viewMode: ProfilingViewMode;
  expandedStacktraceIds: Set<string>;
  updateFilters: (updates: Partial<ProfilingFilters>) => void;
  setRawQuery: (query: string | null) => void;
  setViewMode: (mode: ProfilingViewMode) => void;
  toggleExpandedStacktraceId: (id: string) => void;
  resetFilters: () => void;
}

export const useProfilingStore = create<ProfilingState>()((set) => ({
  filters: { ...EMPTY_FILTERS },
  rawQuery: null,
  viewMode: "topFunctions",
  expandedStacktraceIds: new Set<string>(),
  updateFilters: (updates) =>
    set((state) => ({ filters: { ...state.filters, ...updates }, rawQuery: null })),
  setRawQuery: (query) => set({ rawQuery: query }),
  setViewMode: (mode) => set({ viewMode: mode, rawQuery: null }),
  toggleExpandedStacktraceId: (id) =>
    set((state) => {
      const next = new Set(state.expandedStacktraceIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedStacktraceIds: next };
    }),
  resetFilters: () =>
    set({
      filters: { ...EMPTY_FILTERS },
      rawQuery: null,
      expandedStacktraceIds: new Set<string>(),
    }),
}));

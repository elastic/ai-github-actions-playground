import { create } from "zustand";

import type { ProfilingFilters } from "../components/profiling/profilingQueryBuilder";
import { EMPTY_FILTERS } from "../components/profiling/profilingQueryBuilder";

export type ProfilingViewMode =
  | "topFunctions"
  | "stacktraces"
  | "timeline"
  | "flamegraph"
  | "sandwich";

interface ProfilingState {
  filters: ProfilingFilters;
  rawQuery: string | null;
  viewMode: ProfilingViewMode;
  expandedStacktraceIds: Set<string>;
  sandwichFunctionName: string | null;
  updateFilters: (updates: Partial<ProfilingFilters>) => void;
  setRawQuery: (query: string | null) => void;
  setViewMode: (mode: ProfilingViewMode) => void;
  toggleExpandedStacktraceId: (id: string) => void;
  setSandwichFunctionName: (name: string | null) => void;
  resetFilters: () => void;
}

export const useProfilingStore = create<ProfilingState>()((set) => ({
  filters: { ...EMPTY_FILTERS },
  rawQuery: null,
  viewMode: "topFunctions",
  expandedStacktraceIds: new Set<string>(),
  sandwichFunctionName: null,
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
  setSandwichFunctionName: (name) => set({ sandwichFunctionName: name }),
  resetFilters: () =>
    set({
      filters: { ...EMPTY_FILTERS },
      rawQuery: null,
      expandedStacktraceIds: new Set<string>(),
      sandwichFunctionName: null,
    }),
}));

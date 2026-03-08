/**
 * Profiling domain filter store.
 *
 * Owns all profiling-related filter state: filters, raw query, view mode, and
 * expanded stacktrace IDs.  Extracted from the former monolithic
 * usePageFiltersStore so that Profiling changes don't create merge-conflict
 * hotspots with other observability domains.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { EMPTY_PROFILING_FILTERS, type ProfilingFilters } from "../types/pageFilters";
import { registerResetter } from "./resetRegistry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProfilingViewMode =
  | "topFunctions"
  | "stacktraces"
  | "timeline"
  | "flamegraph"
  | "flamescope";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface ProfilingFiltersState {
  profilingFilters: ProfilingFilters;
  profilingRawQuery: string | null;
  profilingViewMode: ProfilingViewMode;
  expandedStacktraceIds: Set<string>;
  updateProfilingFilters: (updates: Partial<ProfilingFilters>) => void;
  setProfilingRawQuery: (query: string | null) => void;
  setProfilingViewMode: (mode: ProfilingViewMode) => void;
  toggleExpandedStacktraceId: (id: string) => void;
  resetProfilingFilters: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useProfilingFiltersStore = create<ProfilingFiltersState>()(
  devtools(
    (set) => ({
      profilingFilters: { ...EMPTY_PROFILING_FILTERS },
      profilingRawQuery: null,
      profilingViewMode: "topFunctions" as ProfilingViewMode,
      expandedStacktraceIds: new Set<string>(),
      updateProfilingFilters: (updates) =>
        set((s) => ({
          profilingFilters: { ...s.profilingFilters, ...updates },
          profilingRawQuery: null,
        })),
      setProfilingRawQuery: (query) => set({ profilingRawQuery: query }),
      setProfilingViewMode: (mode) => set({ profilingViewMode: mode, profilingRawQuery: null }),
      toggleExpandedStacktraceId: (id) =>
        set((s) => {
          const next = new Set(s.expandedStacktraceIds);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return { expandedStacktraceIds: next };
        }),
      resetProfilingFilters: () =>
        set({
          profilingFilters: { ...EMPTY_PROFILING_FILTERS },
          profilingRawQuery: null,
          profilingViewMode: "topFunctions" as ProfilingViewMode,
          expandedStacktraceIds: new Set<string>(),
        }),
    }),
    { name: "ProfilingFiltersStore", enabled: import.meta.env.DEV },
  ),
);

// ---------------------------------------------------------------------------
// Self-register resetter
// ---------------------------------------------------------------------------

registerResetter("profiling", () => useProfilingFiltersStore.getState().resetProfilingFilters());

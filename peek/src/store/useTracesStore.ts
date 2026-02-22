import { create } from "zustand";
import type { Span } from "../components/traces/traceUtils";
import type { TraceFilters } from "../components/traces/traceQueryBuilder";
import { EMPTY_FILTERS } from "../components/traces/traceQueryBuilder";

export type TracesViewMode = "list" | "timeseries" | "scatter";

interface TracesState {
  /** Structured search filters */
  filters: TraceFilters;
  /** Raw ES|QL query override (when user edits the generated query directly) */
  rawQuery: string | null;
  /** Currently selected trace ID */
  selectedTraceId: string | null;
  /** Spans for the selected trace */
  selectedTraceSpans: Span[];
  /** Currently selected span (for detail drawer) */
  selectedSpanId: string | null;
  /** Results view mode */
  viewMode: TracesViewMode;
  /** Whether the span detail drawer is open */
  drawerOpen: boolean;

  setFilters: (filters: TraceFilters) => void;
  updateFilters: (updates: Partial<TraceFilters>) => void;
  setRawQuery: (query: string | null) => void;
  setSelectedTraceId: (traceId: string | null) => void;
  setSelectedTraceSpans: (spans: Span[]) => void;
  setSelectedSpanId: (spanId: string | null) => void;
  setViewMode: (mode: TracesViewMode) => void;
  setDrawerOpen: (open: boolean) => void;
  addTagFilter: (key: string, value: string, exclude?: boolean) => void;
  removeTagFilter: (index: number) => void;
  resetFilters: () => void;
}

export const useTracesStore = create<TracesState>()((set) => ({
  filters: { ...EMPTY_FILTERS },
  rawQuery: null,
  selectedTraceId: null,
  selectedTraceSpans: [],
  selectedSpanId: null,
  viewMode: "list",
  drawerOpen: false,

  setFilters: (filters) => set({ filters, rawQuery: null }),
  updateFilters: (updates) =>
    set((s) => ({ filters: { ...s.filters, ...updates }, rawQuery: null })),
  setRawQuery: (query) => set({ rawQuery: query }),
  setSelectedTraceId: (traceId) =>
    set({ selectedTraceId: traceId, selectedSpanId: null, drawerOpen: false }),
  setSelectedTraceSpans: (spans) => set({ selectedTraceSpans: spans }),
  setSelectedSpanId: (spanId) => set({ selectedSpanId: spanId, drawerOpen: spanId !== null }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setDrawerOpen: (open) => set({ drawerOpen: open, selectedSpanId: open ? undefined : null }),
  addTagFilter: (key, value, exclude = false) =>
    set((s) => ({
      filters: { ...s.filters, tags: [...s.filters.tags, { key, value, exclude }] },
      rawQuery: null,
    })),
  removeTagFilter: (index) =>
    set((s) => ({
      filters: { ...s.filters, tags: s.filters.tags.filter((_, i) => i !== index) },
      rawQuery: null,
    })),
  resetFilters: () =>
    set({
      filters: { ...EMPTY_FILTERS },
      rawQuery: null,
      selectedTraceId: null,
      selectedTraceSpans: [],
      selectedSpanId: null,
    }),
}));

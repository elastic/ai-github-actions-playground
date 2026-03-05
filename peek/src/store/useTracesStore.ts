import { create } from "zustand";
import { devtools } from "zustand/middleware";

import type { Span } from "../components/traces/traceUtils";
import type { TraceFilters } from "../components/traces/traceQueryBuilder";
import { EMPTY_FILTERS } from "../components/traces/traceQueryBuilder";
import type { EsqlResponse } from "../types";

export type TracesViewMode = "list" | "timeseries" | "scatter" | "serviceMap" | "driftRadar";

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
  /** When true, the orchestrator should auto-execute search on mount */
  pendingSearch: boolean;
  /** Cached search result (persists across navigation) */
  searchResult: EsqlResponse | null;
  /** Cached search spans (persists across navigation) */
  searchSpans: Span[];
  /** Cached timeseries result (persists across navigation) */
  timeseriesResult: EsqlResponse | null;

  setFilters: (filters: TraceFilters) => void;
  updateFilters: (updates: Partial<TraceFilters>) => void;
  /** Update only time bounds (e.g. from picker sync) without clearing rawQuery */
  setTimeRange: (timeFrom: string, timeTo: string) => void;
  setRawQuery: (query: string | null) => void;
  setSelectedTraceId: (traceId: string | null) => void;
  setSelectedTraceSpans: (spans: Span[]) => void;
  setSelectedSpanId: (spanId: string | null) => void;
  setViewMode: (mode: TracesViewMode) => void;
  setDrawerOpen: (open: boolean) => void;
  addTagFilter: (key: string, value: string, exclude?: boolean) => void;
  removeTagFilter: (index: number) => void;
  resetFilters: () => void;
  setPendingSearch: (pending: boolean) => void;
  setSearchResult: (result: EsqlResponse | null) => void;
  setSearchSpans: (spans: Span[]) => void;
  setTimeseriesResult: (result: EsqlResponse | null) => void;
}

const getInitialTracesState = () => ({
  filters: { ...EMPTY_FILTERS },
  rawQuery: null as string | null,
  selectedTraceId: null as string | null,
  selectedTraceSpans: [] as Span[],
  selectedSpanId: null as string | null,
  viewMode: "list" as TracesViewMode,
  drawerOpen: false,
  pendingSearch: false,
  searchResult: null as EsqlResponse | null,
  searchSpans: [] as Span[],
  timeseriesResult: null as EsqlResponse | null,
});

export const useTracesStore = create<TracesState>()(
  devtools(
    (set) => ({
      ...getInitialTracesState(),

      setFilters: (filters) => set({ filters, rawQuery: null }),
      updateFilters: (updates) =>
        set((s) => ({ filters: { ...s.filters, ...updates }, rawQuery: null })),
      setTimeRange: (timeFrom, timeTo) =>
        set((s) => ({ filters: { ...s.filters, timeFrom, timeTo } })),
      setRawQuery: (query) => set({ rawQuery: query }),
      setSelectedTraceId: (traceId) =>
        set({ selectedTraceId: traceId, selectedSpanId: null, drawerOpen: false }),
      setSelectedTraceSpans: (spans) => set({ selectedTraceSpans: spans }),
      setSelectedSpanId: (spanId) => set({ selectedSpanId: spanId, drawerOpen: spanId !== null }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setDrawerOpen: (open) =>
        set(open ? { drawerOpen: true } : { drawerOpen: false, selectedSpanId: null }),
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
      resetFilters: () => set(getInitialTracesState()),
      setPendingSearch: (pending) => set({ pendingSearch: pending }),
      setSearchResult: (result) => set({ searchResult: result }),
      setSearchSpans: (spans) => set({ searchSpans: spans }),
      setTimeseriesResult: (result) => set({ timeseriesResult: result }),
    }),
    { name: "TracesStore", enabled: import.meta.env.DEV },
  ),
);

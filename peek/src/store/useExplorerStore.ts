import { create } from "zustand";
import { devtools } from "zustand/middleware";

import type { AggregationType, ExplorerFilter, FieldInfo, MetricType } from "../services/es";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface ExplorerState {
  indexPattern: string;
  fields: FieldInfo[];
  fieldsLoading: boolean;

  selectedMetric: string | null;
  metricType: MetricType;
  aggregation: AggregationType;

  filters: ExplorerFilter[];
  groupBy: string | null;

  /** Raw ES|QL query override (when user edits the generated query directly) */
  rawQuery: string | null;
  showEsql: boolean;

  // Actions
  setIndexPattern: (pattern: string) => void;
  setFields: (fields: FieldInfo[]) => void;
  setFieldsLoading: (loading: boolean) => void;
  setSelectedMetric: (metric: string | null, metricType?: MetricType) => void;
  setAggregation: (agg: AggregationType) => void;
  addFilter: (filter: ExplorerFilter) => void;
  removeFilter: (index: number) => void;
  clearFilters: () => void;
  setGroupBy: (field: string | null) => void;
  setRawQuery: (query: string | null) => void;
  setShowEsql: (show: boolean) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState: Omit<
  ExplorerState,
  | "setIndexPattern"
  | "setFields"
  | "setFieldsLoading"
  | "setSelectedMetric"
  | "setAggregation"
  | "addFilter"
  | "removeFilter"
  | "clearFilters"
  | "setGroupBy"
  | "setRawQuery"
  | "setShowEsql"
  | "reset"
> = {
  indexPattern: "metrics-*",
  fields: [],
  fieldsLoading: false,
  selectedMetric: null,
  metricType: "gauge",
  aggregation: "avg",
  filters: [],
  groupBy: null,
  rawQuery: null,
  showEsql: false,
};

export const useExplorerStore = create<ExplorerState>()(
  devtools(
    (set) => ({
      ...initialState,

      setIndexPattern: (pattern) =>
        set({
          indexPattern: pattern,
          fields: [],
          selectedMetric: null,
          filters: [],
          groupBy: null,
          rawQuery: null,
        }),
      setFields: (fields) => set({ fields }),
      setFieldsLoading: (loading) => set({ fieldsLoading: loading }),
      setSelectedMetric: (metric, metricType) =>
        set((s) => ({
          selectedMetric: metric,
          metricType: metricType ?? s.metricType,
          aggregation:
            metricType === "counter" ? "count" : metricType === "gauge" ? "avg" : s.aggregation,
          rawQuery: null,
        })),
      setAggregation: (agg) => set({ aggregation: agg, rawQuery: null }),
      addFilter: (filter) => set((s) => ({ filters: [...s.filters, filter], rawQuery: null })),
      removeFilter: (index) =>
        set((s) => ({ filters: s.filters.filter((_, i) => i !== index), rawQuery: null })),
      clearFilters: () => set({ filters: [], rawQuery: null }),
      setGroupBy: (field) => set({ groupBy: field, rawQuery: null }),
      setRawQuery: (rawQuery) => set({ rawQuery }),
      setShowEsql: (show) => set({ showEsql: show }),
      reset: () => set(initialState),
    }),
    { name: "ExplorerStore", enabled: import.meta.env.DEV },
  ),
);

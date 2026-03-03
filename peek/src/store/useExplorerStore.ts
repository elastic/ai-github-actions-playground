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
        }),
      setFields: (fields) => set({ fields }),
      setFieldsLoading: (loading) => set({ fieldsLoading: loading }),
      setSelectedMetric: (metric, metricType) =>
        set((s) => ({
          selectedMetric: metric,
          metricType: metricType ?? s.metricType,
          aggregation:
            metricType === "counter" ? "count" : metricType === "gauge" ? "avg" : s.aggregation,
        })),
      setAggregation: (agg) => set({ aggregation: agg }),
      addFilter: (filter) => set((s) => ({ filters: [...s.filters, filter] })),
      removeFilter: (index) => set((s) => ({ filters: s.filters.filter((_, i) => i !== index) })),
      clearFilters: () => set({ filters: [] }),
      setGroupBy: (field) => set({ groupBy: field }),
      setShowEsql: (show) => set({ showEsql: show }),
      reset: () => set(initialState),
    }),
    { name: "ExplorerStore", enabled: import.meta.env.DEV },
  ),
);

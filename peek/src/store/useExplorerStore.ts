import { create } from "zustand";
import type { TimeRange } from "../types";
import type { AggregationType, ExplorerFilter, FieldInfo, MetricType } from "../services/es";

const VALID_AGGREGATIONS: AggregationType[] = [
  "avg",
  "sum",
  "min",
  "max",
  "count",
  "p50",
  "p95",
  "p99",
];

function isAggregationType(value: string | null): value is AggregationType {
  return value !== null && VALID_AGGREGATIONS.includes(value as AggregationType);
}

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

  queryResult: {
    status: "idle" | "loading" | "success" | "error";
    esql?: string;
    data?: { columns: Array<{ name: string; type: string }>; values: unknown[][] };
    error?: string;
    executionTimeMs?: number;
  };

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
  setQueryResult: (result: ExplorerState["queryResult"]) => void;
  setShowEsql: (show: boolean) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// URL state serialization
// ---------------------------------------------------------------------------

export function serializeExplorerState(
  state: Pick<
    ExplorerState,
    "indexPattern" | "selectedMetric" | "aggregation" | "filters" | "groupBy"
  >,
  timeRange: TimeRange,
): string {
  const params = new URLSearchParams();
  if (state.indexPattern) params.set("index", state.indexPattern);
  if (state.selectedMetric) params.set("metric", state.selectedMetric);
  if (state.aggregation) params.set("agg", state.aggregation);
  if (state.groupBy) params.set("groupBy", state.groupBy);
  params.set("from", timeRange.from);
  params.set("to", timeRange.to);
  for (const f of state.filters) {
    params.append(`filter.${f.field}`, `${f.op}:${f.value}`);
  }
  return params.toString();
}

export function deserializeExplorerState(search: string): {
  indexPattern?: string;
  metric?: string;
  aggregation?: AggregationType;
  groupBy?: string;
  filters: ExplorerFilter[];
  from?: string;
  to?: string;
} {
  const params = new URLSearchParams(search);
  const rawAgg = params.get("agg");
  const filters: ExplorerFilter[] = [];
  for (const [key, value] of params.entries()) {
    if (key.startsWith("filter.")) {
      const field = key.slice("filter.".length);
      const colonIdx = value.indexOf(":");
      if (colonIdx > 0) {
        const op = value.slice(0, colonIdx) as ExplorerFilter["op"];
        const val = value.slice(colonIdx + 1);
        if (op === "==" || op === "!=" || op === "LIKE") {
          filters.push({ field, op, value: val });
        }
      }
    }
  }

  return {
    indexPattern: params.get("index") ?? undefined,
    metric: params.get("metric") ?? undefined,
    aggregation: isAggregationType(rawAgg) ? rawAgg : undefined,
    groupBy: params.get("groupBy") ?? undefined,
    filters,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  };
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
  | "setQueryResult"
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
  queryResult: { status: "idle" },
  showEsql: false,
};

export const useExplorerStore = create<ExplorerState>()((set) => ({
  ...initialState,

  setIndexPattern: (pattern) =>
    set({
      indexPattern: pattern,
      fields: [],
      selectedMetric: null,
      filters: [],
      groupBy: null,
      queryResult: { status: "idle" },
    }),
  setFields: (fields) => set({ fields }),
  setFieldsLoading: (loading) => set({ fieldsLoading: loading }),
  setSelectedMetric: (metric, metricType) =>
    set((s) => ({
      selectedMetric: metric,
      metricType: metricType ?? s.metricType,
      aggregation:
        metricType === "counter" ? "sum" : metricType === "gauge" ? "avg" : s.aggregation,
    })),
  setAggregation: (agg) => set({ aggregation: agg }),
  addFilter: (filter) => set((s) => ({ filters: [...s.filters, filter] })),
  removeFilter: (index) => set((s) => ({ filters: s.filters.filter((_, i) => i !== index) })),
  clearFilters: () => set({ filters: [] }),
  setGroupBy: (field) => set({ groupBy: field }),
  setQueryResult: (result) => set({ queryResult: result }),
  setShowEsql: (show) => set({ showEsql: show }),
  reset: () => set(initialState),
}));

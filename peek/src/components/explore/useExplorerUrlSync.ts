import { useEffect, useRef } from "react";
import type { SetValues } from "nuqs";

import type { AggregationType, ExplorerFilter } from "../../services/es";

import {
  parseLegacyFilters,
  parseEncodedFilters,
  encodeFilters,
  metricNamespaceOf,
} from "./exploreUtils";
import type { explorerSearchParsers } from "./exploreUtils";

type UrlState = {
  indexPattern: string | null;
  selectedMetric: string | null;
  aggregation: AggregationType | null;
  groupBy: string | null;
  from: string | null;
  to: string | null;
};

interface UseExplorerUrlSyncOptions {
  initialSearch: string;
  initialUrlFilters: string | null;
  initialUrlState: UrlState;
  indexPattern: string;
  selectedMetric: string | null;
  aggregation: AggregationType;
  filters: ExplorerFilter[];
  groupBy: string | null;
  timeRange: { from: string; to: string };
  setIndexPattern: (pattern: string) => void;
  setSelectedMetric: (metric: string | null) => void;
  setSelectedNamespace: (ns: string | null) => void;
  setAggregation: (agg: AggregationType) => void;
  addFilter: (filter: ExplorerFilter) => void;
  clearFilters: () => void;
  setGroupBy: (field: string | null) => void;
  setTimeRange: (range: { from: string; to: string }) => void;
  setUrlState: SetValues<typeof explorerSearchParsers>;
  setUrlFilters: (v: string | null) => Promise<URLSearchParams>;
}

export function useExplorerUrlSync({
  initialSearch,
  initialUrlFilters,
  initialUrlState,
  indexPattern,
  selectedMetric,
  aggregation,
  filters,
  groupBy,
  timeRange,
  setIndexPattern,
  setSelectedMetric,
  setSelectedNamespace,
  setAggregation,
  addFilter,
  clearFilters,
  setGroupBy,
  setTimeRange,
  setUrlState,
  setUrlFilters,
}: UseExplorerUrlSyncOptions) {
  const hasHydratedFromUrlRef = useRef(false);
  const skipInitialUrlSyncRef = useRef(true);

  // Restore explorer state from URL on first mount
  useEffect(() => {
    if (initialUrlState.indexPattern) {
      setIndexPattern(initialUrlState.indexPattern);
    }
    if (initialUrlState.selectedMetric) {
      setSelectedMetric(initialUrlState.selectedMetric);
      setSelectedNamespace(metricNamespaceOf(initialUrlState.selectedMetric));
    }
    if (initialUrlState.aggregation) {
      setAggregation(initialUrlState.aggregation);
    }
    if (initialUrlState.groupBy) {
      setGroupBy(initialUrlState.groupBy);
    }
    const hasEncodedFiltersParam = initialUrlFilters !== null;
    const initialEncodedFilters = parseEncodedFilters(initialUrlFilters);
    const hydratedFilters = hasEncodedFiltersParam
      ? initialEncodedFilters
      : parseLegacyFilters(initialSearch);
    clearFilters();
    for (const filter of hydratedFilters) {
      addFilter(filter);
    }
    if (initialUrlState.from && initialUrlState.to) {
      setTimeRange({ from: initialUrlState.from, to: initialUrlState.to });
    }
    hasHydratedFromUrlRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync URL state
  useEffect(() => {
    if (!hasHydratedFromUrlRef.current) return;
    if (skipInitialUrlSyncRef.current) {
      skipInitialUrlSyncRef.current = false;
      return;
    }
    let cancelled = false;
    const syncUrlState = async () => {
      await Promise.all([
        setUrlState({
          indexPattern: indexPattern || null,
          selectedMetric: selectedMetric || null,
          aggregation,
          groupBy: groupBy || null,
          from: timeRange.from,
          to: timeRange.to,
        }),
        setUrlFilters(encodeFilters(filters)),
      ]);
      if (cancelled) return;
    };
    void syncUrlState();
    return () => {
      cancelled = true;
    };
  }, [
    indexPattern,
    selectedMetric,
    aggregation,
    filters,
    groupBy,
    timeRange,
    setUrlState,
    setUrlFilters,
  ]);
}

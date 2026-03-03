import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useQueryClient, useQuery } from "@tanstack/react-query";

import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import { useConnectionStore } from "../../store/useConnectionStore";
import { usePageFiltersStore } from "../../store/usePageFiltersStore";
import { useTracesStore } from "../../store/useTracesStore";
import { EMPTY_FILTERS } from "../traces/traceQueryBuilder";
import { PAGE_MANIFEST } from "../../routes/manifest";
import type { EsqlResponse } from "../../types";

import {
  buildServiceInventoryQuery,
  buildServiceSparklineQuery,
} from "./serviceInventoryQueryBuilder";
import {
  type SortField,
  type SortDirection,
  type ServiceSparklineData,
  parseServiceRows,
  parseServiceSparklineData,
} from "./serviceInventoryHelpers";

export function useServiceInventorySearch() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const connection = useConnectionStore((s) => s.connection);
  const { filters, serviceSearchSession, updateFilters, resetFilters } = usePageFiltersStore(
    useShallow((s) => ({
      filters: s.serviceFilters,
      serviceSearchSession: s.serviceSearchSession,
      updateFilters: s.updateServiceFilters,
      resetFilters: s.resetServiceFilters,
    })),
  );
  const serviceSearchQueryKey = useMemo(
    () => ["services-search", serviceSearchSession] as const,
    [serviceSearchSession],
  );

  const { data: searchResult = null } = useQuery<EsqlResponse | null>({
    queryKey: serviceSearchQueryKey,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setSearchResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(serviceSearchQueryKey, result),
    [queryClient, serviceSearchQueryKey],
  );
  const [sparklineData, setSparklineData] = useState<Record<string, ServiceSparklineData>>({});
  const [sortField, setSortField] = useState<SortField>("requestCount");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const latestQueryRef = useRef<string | null>(null);
  const latestSparklineQueryRef = useRef<string | null>(null);

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField],
  );

  const handleSuccess = useCallback(
    (data: EsqlResponse, executedQuery: string) => {
      if (executedQuery !== latestQueryRef.current) return;
      setSearchResult(data);
    },
    [setSearchResult],
  );
  const handleFailure = useCallback(
    (failedQuery: string) => {
      if (failedQuery !== latestQueryRef.current) return;
      setSearchResult(null);
    },
    [setSearchResult],
  );
  const { runQuery, loading, error, clearError } = useEsqlQuery({
    connection,
    onSuccess: handleSuccess,
    onFailure: handleFailure,
  });
  const handleSparklineSuccess = useCallback((data: EsqlResponse, executedQuery: string) => {
    if (executedQuery !== latestSparklineQueryRef.current) return;
    setSparklineData(parseServiceSparklineData(data));
  }, []);
  const handleSparklineFailure = useCallback((failedQuery: string) => {
    if (failedQuery !== latestSparklineQueryRef.current) return;
    setSparklineData({});
  }, []);
  const { runQuery: runSparklineQuery } = useEsqlQuery({
    connection,
    onSuccess: handleSparklineSuccess,
    onFailure: handleSparklineFailure,
  });

  const handleSearch = useCallback(() => {
    const query = buildServiceInventoryQuery(filters);
    const visibleServiceNames = searchResult
      ? parseServiceRows(searchResult).map((row) => row.serviceName)
      : [];
    const sparklineQuery = buildServiceSparklineQuery(filters, undefined, visibleServiceNames);
    latestQueryRef.current = query.trim();
    latestSparklineQueryRef.current = sparklineQuery.trim();
    setSparklineData({});
    runQuery(query);
    runSparklineQuery(sparklineQuery);
  }, [filters, runQuery, runSparklineQuery, searchResult]);

  const handleReset = useCallback(() => {
    if (loading) return;
    latestQueryRef.current = null;
    latestSparklineQueryRef.current = null;
    clearError();
    setSearchResult(null);
    setSparklineData({});
    resetFilters();
  }, [clearError, resetFilters, loading, setSearchResult]);

  const handleViewTraces = useCallback(
    (serviceName: string) => {
      useTracesStore.getState().setFilters({
        ...EMPTY_FILTERS,
        timeFrom: filters.timeFrom,
        timeTo: filters.timeTo,
        services: [serviceName],
      });
      navigate(PAGE_MANIFEST.traces.path);
    },
    [navigate, filters.timeFrom, filters.timeTo],
  );

  const serviceRows = useMemo(() => {
    if (!searchResult) return [];
    const rows = parseServiceRows(searchResult);
    return rows.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [searchResult, sortField, sortDirection]);

  return {
    filters,
    updateFilters,
    searchResult,
    sparklineData,
    serviceRows,
    sortField,
    sortDirection,
    loading,
    error,
    handleSort,
    handleSearch,
    handleReset,
    handleViewTraces,
    latestQueryRef,
  };
}

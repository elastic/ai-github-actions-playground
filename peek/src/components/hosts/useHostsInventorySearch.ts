import { useCallback, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useQueryClient, useQuery } from "@tanstack/react-query";

import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import { useConnectionStore } from "../../store/useConnectionStore";
import { usePageFiltersStore } from "../../store/usePageFiltersStore";
import type { EsqlResponse } from "../../types";
import type { HostOsType, HostRow } from "./hostTypes";

import { buildHostInventoryQuery, type HostQueryFilters } from "./hostQueryBuilder";
import { parseHostInventory } from "./hostHelpers";

export type HostSortDirection = "asc" | "desc";

export function useHostsInventorySearch(osTypeOverride?: HostOsType) {
  const queryClient = useQueryClient();
  const connection = useConnectionStore((s) => s.connection);
  const { filters, updateFilters, resetFilters } = usePageFiltersStore(
    useShallow((s) => ({
      filters: s.hostsFilters,
      updateFilters: s.updateHostsFilters,
      resetFilters: s.resetHostsFilters,
    })),
  );

  const cacheKey = useMemo(
    () => ["hosts-search", connection?.url, osTypeOverride ?? filters.osFilter] as const,
    [connection?.url, osTypeOverride, filters.osFilter],
  );

  const { data: searchResult = null } = useQuery<EsqlResponse | null>({
    queryKey: cacheKey,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setSearchResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(cacheKey, result),
    [queryClient, cacheKey],
  );

  const [sortField, setSortField] = useState<keyof HostRow>("lastSeen");
  const [sortDirection, setSortDirection] = useState<HostSortDirection>("desc");
  const latestQueryRef = useRef<string | null>(null);

  const handleSort = useCallback(
    (field: keyof HostRow) => {
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

  const cancelSearch = useCallback(() => {
    latestQueryRef.current = null;
  }, []);

  const handleSearch = useCallback(() => {
    const effectiveOsType =
      osTypeOverride ?? (filters.osFilter === "all" ? undefined : filters.osFilter);
    const queryFilters: HostQueryFilters = {
      timeFrom: filters.timeFrom,
      timeTo: filters.timeTo,
      osType: effectiveOsType,
      search: filters.search || undefined,
    };
    const query = buildHostInventoryQuery(queryFilters);
    latestQueryRef.current = query.trim();
    runQuery(query);
  }, [filters, osTypeOverride, runQuery]);

  const handleReset = useCallback(() => {
    if (loading) return;
    latestQueryRef.current = null;
    clearError();
    setSearchResult(null);
    resetFilters();
  }, [clearError, resetFilters, loading, setSearchResult]);

  const hostRows = useMemo<HostRow[]>(() => {
    if (!searchResult) return [];
    const rows = parseHostInventory(searchResult);
    return sortRows(rows, sortField, sortDirection);
  }, [searchResult, sortField, sortDirection]);

  return {
    filters,
    updateFilters,
    searchResult,
    hostRows,
    sortField,
    sortDirection,
    loading,
    error,
    handleSort,
    handleSearch,
    handleReset,
    cancelSearch,
  };
}

function sortRows(rows: HostRow[], field: keyof HostRow, direction: HostSortDirection): HostRow[] {
  return rows.slice().sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === "string" && typeof bVal === "string") {
      return direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return direction === "asc"
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });
}

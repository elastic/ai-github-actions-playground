import { useCallback, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useSimpleEsqlQuery } from "../../hooks/useSimpleEsqlQuery";
import { usePageFiltersStore } from "../../store/usePageFiltersStore";
import type { HostOsType, HostRow } from "./hostTypes";

import { buildHostInventoryQuery, type HostQueryFilters } from "./hostQueryBuilder";
import { parseHostInventory } from "./hostHelpers";

export type HostSortDirection = "asc" | "desc";

export function useHostsInventorySearch(osTypeOverride?: HostOsType) {
  const { filters, updateFilters, resetFilters } = usePageFiltersStore(
    useShallow((s) => ({
      filters: s.hostsFilters,
      updateFilters: s.updateHostsFilters,
      resetFilters: s.resetHostsFilters,
    })),
  );

  const [sortField, setSortField] = useState<keyof HostRow>("lastSeen");
  const [sortDirection, setSortDirection] = useState<HostSortDirection>("desc");

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

  // Build the query declaratively — it auto-executes via useSimpleEsqlQuery.
  const esqlQuery = useMemo(() => {
    const effectiveOsType =
      osTypeOverride ?? (filters.osFilter === "all" ? undefined : filters.osFilter);
    const queryFilters: HostQueryFilters = {
      timeFrom: filters.timeFrom,
      timeTo: filters.timeTo,
      osType: effectiveOsType,
      search: filters.search || undefined,
    };
    return buildHostInventoryQuery(queryFilters);
  }, [filters, osTypeOverride]);

  const { data: searchResult, loading, error, refetch } = useSimpleEsqlQuery({ query: esqlQuery });

  const handleReset = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

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
    handleReset,
    refetch,
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

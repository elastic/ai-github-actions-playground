import { useCallback, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useQueryClient, useQuery } from "@tanstack/react-query";

import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import { useConnectionStore } from "../../store/useConnectionStore";
import { usePageFiltersStore } from "../../store/usePageFiltersStore";
import { useTableSort } from "../../hooks/useTableSort";
import type { KubernetesActiveTab } from "../../types/pageFilters";
import type { EsqlResponse } from "../../types";

import {
  buildAllWorkloadsInventoryQuery,
  buildClusterInventoryQuery,
  buildNamespaceInventoryQuery,
  buildPodInventoryQuery,
  type K8sQueryFilters,
} from "./k8sQueryBuilder";
import {
  type ClusterRow,
  type NamespaceRow,
  type WorkloadRow,
  type PodRow,
  parseClusterInventory,
  parseNamespaceInventory,
  parseWorkloadInventory,
  parsePodInventory,
} from "./k8sHelpers";

export type K8sSortDirection = "asc" | "desc";
const DEFAULT_SORT_FIELD: Record<KubernetesActiveTab, string> = {
  clusters: "podCount",
  namespaces: "podCount",
  workloads: "podCount",
  pods: "restarts",
};

function buildQueryForTab(tab: KubernetesActiveTab, filters: K8sQueryFilters): string {
  switch (tab) {
    case "clusters":
      return buildClusterInventoryQuery(filters);
    case "namespaces":
      return buildNamespaceInventoryQuery(filters);
    case "workloads":
      return buildAllWorkloadsInventoryQuery(filters);
    case "pods":
      return buildPodInventoryQuery(filters);
  }
}

export function useK8sInventorySearch() {
  const queryClient = useQueryClient();
  const connection = useConnectionStore((s) => s.connection);
  const { filters, updateFilters, resetFilters } = usePageFiltersStore(
    useShallow((s) => ({
      filters: s.kubernetesFilters,
      updateFilters: s.updateKubernetesFilters,
      resetFilters: s.resetKubernetesFilters,
    })),
  );

  const searchQueryKey = useMemo(
    () => ["k8s-search", filters.activeTab] as const,
    [filters.activeTab],
  );

  const { data: searchResult = null } = useQuery<EsqlResponse | null>({
    queryKey: searchQueryKey,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setSearchResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(searchQueryKey, result),
    [queryClient, searchQueryKey],
  );

  const {
    sortField,
    sortDirection,
    handleSort,
    getSortLabelProps,
    setSortField,
    setSortDirection,
  } = useTableSort<string>(DEFAULT_SORT_FIELD[filters.activeTab], "desc");
  const latestQueryRef = useRef<string | null>(null);

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
    const queryFilters: K8sQueryFilters = {
      timeFrom: filters.timeFrom,
      timeTo: filters.timeTo,
      cluster: filters.cluster ?? undefined,
      namespace: filters.namespace ?? undefined,
    };
    const query = buildQueryForTab(filters.activeTab, queryFilters);
    latestQueryRef.current = query.trim();
    runQuery(query);
  }, [filters, runQuery]);

  const handleReset = useCallback(() => {
    if (loading) return;
    latestQueryRef.current = null;
    clearError();
    setSearchResult(null);
    resetFilters();
  }, [clearError, resetFilters, loading, setSearchResult]);

  const handleTabChange = useCallback(
    (tab: KubernetesActiveTab) => {
      cancelSearch();
      clearError();
      setSearchResult(null);
      setSortField(DEFAULT_SORT_FIELD[tab]);
      setSortDirection("desc");
      updateFilters({ activeTab: tab });
    },
    [cancelSearch, clearError, setSearchResult, updateFilters],
  );

  const clusterRows = useMemo<ClusterRow[]>(() => {
    if (!searchResult || filters.activeTab !== "clusters") return [];
    const rows = parseClusterInventory(searchResult);
    return sortRows(rows, sortField, sortDirection);
  }, [searchResult, filters.activeTab, sortField, sortDirection]);

  const namespaceRows = useMemo<NamespaceRow[]>(() => {
    if (!searchResult || filters.activeTab !== "namespaces") return [];
    const rows = parseNamespaceInventory(searchResult);
    return sortRows(rows, sortField, sortDirection);
  }, [searchResult, filters.activeTab, sortField, sortDirection]);

  const workloadRows = useMemo<WorkloadRow[]>(() => {
    if (!searchResult || filters.activeTab !== "workloads") return [];
    const rows = parseWorkloadInventory(searchResult);
    return sortRows(rows, sortField, sortDirection);
  }, [searchResult, filters.activeTab, sortField, sortDirection]);

  const podRows = useMemo<PodRow[]>(() => {
    if (!searchResult || filters.activeTab !== "pods") return [];
    const rows = parsePodInventory(searchResult);
    return sortRows(rows, sortField, sortDirection);
  }, [searchResult, filters.activeTab, sortField, sortDirection]);

  return {
    filters,
    updateFilters,
    searchResult,
    clusterRows,
    namespaceRows,
    workloadRows,
    podRows,
    sortField,
    sortDirection,
    loading,
    error,
    handleSort,
    getSortLabelProps,
    handleSearch,
    handleReset,
    handleTabChange,
    cancelSearch,
  };
}

function sortRows<T>(rows: T[], field: string, direction: K8sSortDirection): T[] {
  return rows.slice().sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[field];
    const bVal = (b as Record<string, unknown>)[field];
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

import { useCallback, useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ElasticsearchClient,
  isElasticsearchError,
  type CatAllocationRecord,
  type CatShardRecord,
  type ClusterAllocationExplainResponse,
  type ClusterHealthResponse,
  type ClusterPendingTasksResponse,
  type ClusterSettingsResponse,
  type ClusterStatsResponse,
  type IlmExplainResponse,
  type NodesStatsResponse,
  type RecoveryResponse,
  type SlmStatsResponse,
  type SnapshotStatusResponse,
} from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";

import { useRefetchOnConnectionChange } from "./useEsQuery";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClusterHealthData {
  clusterHealth: ClusterHealthResponse | null;
  pendingTasks: ClusterPendingTasksResponse | null;
  allocation: CatAllocationRecord[] | null;
  clusterStats: ClusterStatsResponse | null;
  nodeStats: NodesStatsResponse | null;
  shards: CatShardRecord[] | null;
  recovery: RecoveryResponse | null;
  ilm: IlmExplainResponse | null;
  slm: SlmStatsResponse | null;
  snapshots: SnapshotStatusResponse | null;
  clusterSettings: ClusterSettingsResponse | null;
  allocationExplain: ClusterAllocationExplainResponse | null;
}

export interface UseClusterHealthDataReturn {
  data: ClusterHealthData;
  loading: boolean;
  error: string | null;
  partialErrors: string[];
  lastUpdatedAt: string | null;
  refresh: () => void;
  refreshIntervalMs: number;
  setRefreshIntervalMs: (ms: number) => void;
}

const DEFAULT_REFRESH_MS = 30_000;

const QUERY_NAMES = [
  "cluster health",
  "pending tasks",
  "allocation",
  "cluster stats",
  "node stats",
  "shards",
  "recovery",
  "ILM",
  "SLM",
  "snapshots",
  "cluster settings",
] as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClusterHealthData(): UseClusterHealthDataReturn {
  const connection = useConnectionStore((s) => s.connection);
  const queryClient = useQueryClient();
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(DEFAULT_REFRESH_MS);

  const connUrl = connection?.url;
  const shared = useMemo(
    () => ({
      enabled: Boolean(connection),
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: refreshIntervalMs > 0 ? refreshIntervalMs : (false as const),
    }),
    [connection, refreshIntervalMs],
  );

  const clusterQueries = useQueries({
    queries: [
      {
        queryKey: ["cluster-health", "health", connUrl],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          new ElasticsearchClient(connection!).getClusterHealth("indices", signal),
        ...shared,
      },
      {
        queryKey: ["cluster-health", "pending-tasks", connUrl],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          new ElasticsearchClient(connection!).getPendingTasks(signal),
        ...shared,
      },
      {
        queryKey: ["cluster-health", "allocation", connUrl],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          new ElasticsearchClient(connection!).getCatAllocation(signal),
        ...shared,
      },
      {
        queryKey: ["cluster-health", "cluster-stats", connUrl],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          new ElasticsearchClient(connection!).getClusterStats(signal),
        ...shared,
      },
      {
        queryKey: ["cluster-health", "node-stats", connUrl],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          new ElasticsearchClient(connection!).getNodeStats(signal),
        ...shared,
      },
      {
        queryKey: ["cluster-health", "shards", connUrl],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          new ElasticsearchClient(connection!).getCatShards(signal),
        ...shared,
      },
      {
        queryKey: ["cluster-health", "recovery", connUrl],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          new ElasticsearchClient(connection!).getRecoveryStatus(signal),
        ...shared,
      },
      {
        queryKey: ["cluster-health", "ilm", connUrl],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          new ElasticsearchClient(connection!).getIlmExplainAll(signal),
        ...shared,
      },
      {
        queryKey: ["cluster-health", "slm", connUrl],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          new ElasticsearchClient(connection!).getSlmStats(signal),
        ...shared,
      },
      {
        queryKey: ["cluster-health", "snapshots", connUrl],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          new ElasticsearchClient(connection!).getSnapshotStatus(signal),
        ...shared,
      },
      {
        queryKey: ["cluster-health", "cluster-settings", connUrl],
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          try {
            return await new ElasticsearchClient(connection!).getClusterSettings(signal);
          } catch (err) {
            if (isElasticsearchError(err) && err.status === 403)
              return null as ClusterSettingsResponse | null;
            throw err;
          }
        },
        ...shared,
      },
    ],
  });

  // Pass 2: conditional allocation explain
  const healthData = clusterQueries[0]?.data;
  const hasUnassigned = (healthData?.unassigned_shards ?? 0) > 0;

  const allocationExplainQuery = useQuery({
    queryKey: ["cluster-health", "allocation-explain", connUrl],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      try {
        return await new ElasticsearchClient(connection!).getAllocationExplain(signal);
      } catch {
        // 400 = no unassigned shards to explain, or 403 = no permissions
        return null as ClusterAllocationExplainResponse | null;
      }
    },
    ...shared,
    enabled: shared.enabled && hasUnassigned,
  });

  // -- Derived state --------------------------------------------------------

  const data: ClusterHealthData = {
    clusterHealth: (clusterQueries[0]?.data as ClusterHealthResponse) ?? null,
    pendingTasks: (clusterQueries[1]?.data as ClusterPendingTasksResponse) ?? null,
    allocation: (clusterQueries[2]?.data as CatAllocationRecord[]) ?? null,
    clusterStats: (clusterQueries[3]?.data as ClusterStatsResponse) ?? null,
    nodeStats: (clusterQueries[4]?.data as NodesStatsResponse) ?? null,
    shards: (clusterQueries[5]?.data as CatShardRecord[]) ?? null,
    recovery: (clusterQueries[6]?.data as RecoveryResponse) ?? null,
    ilm: (clusterQueries[7]?.data as IlmExplainResponse) ?? null,
    slm: (clusterQueries[8]?.data as SlmStatsResponse) ?? null,
    snapshots: (clusterQueries[9]?.data as SnapshotStatusResponse) ?? null,
    clusterSettings: (clusterQueries[10]?.data as ClusterSettingsResponse) ?? null,
    allocationExplain: (allocationExplainQuery.data as ClusterAllocationExplainResponse) ?? null,
  };

  const loading = clusterQueries.some((q) => q.isFetching) || allocationExplainQuery.isFetching;

  const allFailed =
    clusterQueries.length > 0 &&
    clusterQueries.every((q) => q.isError) &&
    !clusterQueries.some((q) => q.isFetching);
  const error = allFailed ? String((clusterQueries[0].error as Error).message) : null;

  const partialErrors: string[] = allFailed
    ? []
    : clusterQueries.reduce<string[]>((acc, q, i) => {
        if (q.isError) acc.push(QUERY_NAMES[i]!);
        return acc;
      }, []);

  const maxUpdatedAt = Math.max(
    ...clusterQueries.map((q) => q.dataUpdatedAt || 0),
    allocationExplainQuery.dataUpdatedAt || 0,
  );
  const lastUpdatedAt = maxUpdatedAt > 0 ? new Date(maxUpdatedAt).toISOString() : null;

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["cluster-health"] });
  }, [queryClient]);

  useRefetchOnConnectionChange(connection, refresh);

  return {
    data,
    loading,
    error,
    partialErrors,
    lastUpdatedAt,
    refresh,
    refreshIntervalMs,
    setRefreshIntervalMs,
  };
}

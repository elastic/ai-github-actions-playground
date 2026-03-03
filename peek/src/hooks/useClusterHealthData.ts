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

  // Named indices into the clusterQueries array — avoids fragile positional indexing.
  const Q = {
    health: 0,
    pendingTasks: 1,
    allocation: 2,
    clusterStats: 3,
    nodeStats: 4,
    shards: 5,
    recovery: 6,
    ilm: 7,
    slm: 8,
    snapshots: 9,
    clusterSettings: 10,
  } as const;

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
          } catch (err: unknown) {
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
  const healthData = clusterQueries[Q.health]?.data as ClusterHealthResponse | undefined;
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

  // Extract query data references for stable memoization dependencies.
  const healthResult = clusterQueries[Q.health]?.data;
  const pendingTasksResult = clusterQueries[Q.pendingTasks]?.data;
  const allocationResult = clusterQueries[Q.allocation]?.data;
  const clusterStatsResult = clusterQueries[Q.clusterStats]?.data;
  const nodeStatsResult = clusterQueries[Q.nodeStats]?.data;
  const shardsResult = clusterQueries[Q.shards]?.data;
  const recoveryResult = clusterQueries[Q.recovery]?.data;
  const ilmResult = clusterQueries[Q.ilm]?.data;
  const slmResult = clusterQueries[Q.slm]?.data;
  const snapshotsResult = clusterQueries[Q.snapshots]?.data;
  const clusterSettingsResult = clusterQueries[Q.clusterSettings]?.data;
  const allocationExplainResult = allocationExplainQuery.data;

  const data: ClusterHealthData = useMemo(
    () => ({
      clusterHealth: (healthResult as ClusterHealthResponse) ?? null,
      pendingTasks: (pendingTasksResult as ClusterPendingTasksResponse) ?? null,
      allocation: (allocationResult as CatAllocationRecord[]) ?? null,
      clusterStats: (clusterStatsResult as ClusterStatsResponse) ?? null,
      nodeStats: (nodeStatsResult as NodesStatsResponse) ?? null,
      shards: (shardsResult as CatShardRecord[]) ?? null,
      recovery: (recoveryResult as RecoveryResponse) ?? null,
      ilm: (ilmResult as IlmExplainResponse) ?? null,
      slm: (slmResult as SlmStatsResponse) ?? null,
      snapshots: (snapshotsResult as SnapshotStatusResponse) ?? null,
      clusterSettings: (clusterSettingsResult as ClusterSettingsResponse) ?? null,
      allocationExplain: (allocationExplainResult as ClusterAllocationExplainResponse) ?? null,
    }),
    [
      healthResult,
      pendingTasksResult,
      allocationResult,
      clusterStatsResult,
      nodeStatsResult,
      shardsResult,
      recoveryResult,
      ilmResult,
      slmResult,
      snapshotsResult,
      clusterSettingsResult,
      allocationExplainResult,
    ],
  );

  const loading = clusterQueries.some((q) => q.isFetching) || allocationExplainQuery.isFetching;

  const allFailed =
    clusterQueries.length > 0 &&
    clusterQueries.every((q) => q.isError) &&
    !clusterQueries.some((q) => q.isFetching);
  const error = allFailed ? String((clusterQueries[Q.health]!.error as Error).message) : null;

  const errorStates = clusterQueries.map((q) => q.isError);
  const partialErrors: string[] = useMemo(
    () =>
      allFailed
        ? []
        : errorStates.reduce<string[]>((acc, isError, i) => {
            if (isError) acc.push(QUERY_NAMES[i]!);
            return acc;
          }, []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- spreading errorStates for per-query shallow comparison
    [allFailed, ...errorStates],
  );

  const dataUpdatedTimes = clusterQueries.map((q) => q.dataUpdatedAt);
  const allocExplainUpdatedAt = allocationExplainQuery.dataUpdatedAt;
  const lastUpdatedAt = useMemo(() => {
    const maxUpdatedAt = Math.max(
      ...dataUpdatedTimes.map((t) => t || 0),
      allocExplainUpdatedAt || 0,
    );
    return maxUpdatedAt > 0 ? new Date(maxUpdatedAt).toISOString() : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- spreading dataUpdatedTimes for per-query shallow comparison
  }, [...dataUpdatedTimes, allocExplainUpdatedAt]);

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

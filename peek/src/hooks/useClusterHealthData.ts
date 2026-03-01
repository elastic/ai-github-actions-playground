import { useCallback, useEffect, useRef, useState } from "react";

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

const EMPTY_DATA: ClusterHealthData = {
  clusterHealth: null,
  pendingTasks: null,
  allocation: null,
  clusterStats: null,
  nodeStats: null,
  shards: null,
  recovery: null,
  ilm: null,
  slm: null,
  snapshots: null,
  clusterSettings: null,
  allocationExplain: null,
};

const DEFAULT_REFRESH_MS = 30_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClusterHealthData(): UseClusterHealthDataReturn {
  const connection = useConnectionStore((s) => s.connection);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);

  const [data, setData] = useState<ClusterHealthData>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialErrors, setPartialErrors] = useState<string[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(DEFAULT_REFRESH_MS);

  const loadData = useCallback(
    async (abortInFlight = true) => {
      if (!connection) {
        abortRef.current?.abort();
        inFlightRef.current = false;
        setData(EMPTY_DATA);
        setError(null);
        setPartialErrors([]);
        setLastUpdatedAt(null);
        setLoading(false);
        return;
      }

      if (!abortInFlight && inFlightRef.current) {
        return;
      }

      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;
      const seq = ++requestSeqRef.current;
      inFlightRef.current = true;

      setLoading(true);
      setError(null);
      setPartialErrors([]);

      try {
        const client = new ElasticsearchClient(connection);

        // Pass 1: all APIs in parallel
        const results = await Promise.allSettled([
          client.getClusterHealth("indices", signal),
          client.getPendingTasks(signal),
          client.getCatAllocation(signal),
          client.getClusterStats(signal),
          client.getNodeStats(signal),
          client.getCatShards(signal),
          client.getRecoveryStatus(signal),
          client.getIlmExplainAll(signal),
          client.getSlmStats(signal),
          client.getSnapshotStatus(signal),
          client.getClusterSettings(signal).catch((err) => {
            if (isElasticsearchError(err) && err.status === 403) return null;
            throw err;
          }),
        ]);

        if (signal.aborted || seq !== requestSeqRef.current) return;

        const [
          clusterHealth,
          pendingTasks,
          allocation,
          clusterStats,
          nodeStats,
          shards,
          recovery,
          ilm,
          slm,
          snapshots,
          clusterSettings,
        ] = results;

        const val = <T>(r: PromiseSettledResult<T>): T | null =>
          r.status === "fulfilled" ? r.value : null;

        const healthData = val(clusterHealth);

        // Pass 2: conditional allocation explain
        let allocationExplain: ClusterAllocationExplainResponse | null = null;
        if ((healthData?.unassigned_shards ?? 0) > 0) {
          try {
            allocationExplain = await client.getAllocationExplain(signal);
          } catch {
            // 400 = no unassigned shards to explain, or 403 = no permissions
          }
        }

        if (signal.aborted || seq !== requestSeqRef.current) return;

        setData({
          clusterHealth: healthData,
          pendingTasks: val(pendingTasks),
          allocation: val(allocation),
          clusterStats: val(clusterStats),
          nodeStats: val(nodeStats),
          shards: val(shards),
          recovery: val(recovery),
          ilm: val(ilm),
          slm: val(slm),
          snapshots: val(snapshots),
          clusterSettings: val(clusterSettings),
          allocationExplain,
        });

        // Collect partial failures
        const failures: string[] = [];
        const names = [
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
        ];
        results.forEach((r, i) => {
          if (r.status === "rejected") failures.push(names[i]!);
        });

        setPartialErrors(failures);
        setLastUpdatedAt(new Date().toISOString());
      } catch (err) {
        if (signal.aborted) return;
        if (seq !== requestSeqRef.current) return;
        setError(isElasticsearchError(err) ? err.message : String(err));
      } finally {
        if (seq === requestSeqRef.current) {
          inFlightRef.current = false;
          setLoading(false);
        }
      }
    },
    [connection],
  );

  // Initial load + reload on connection change
  useEffect(() => {
    void loadData();
    return () => {
      abortRef.current?.abort();
    };
  }, [loadData]);

  // Auto-refresh
  const loadRef = useRef(loadData);
  loadRef.current = loadData;

  useEffect(() => {
    if (refreshIntervalMs <= 0) return;
    const id = setInterval(() => {
      void loadRef.current(false);
    }, refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs]);

  return {
    data,
    loading,
    error,
    partialErrors,
    lastUpdatedAt,
    refresh: loadData,
    refreshIntervalMs,
    setRefreshIntervalMs,
  };
}

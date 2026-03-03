import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { isElasticsearchError } from "../services/es";
import {
  loadFleetServerStatus,
  loadFleetAgentVersions,
  loadFleetOutputHealth,
  loadElasticAgentInventory,
  loadFleetActions,
  loadFleetActionResults,
  type FleetServerStatusMetrics,
  type FleetAgentVersionCount,
  type FleetOutputHealth,
  type ElasticAgentInfo,
  type FleetAction,
  type FleetActionResult,
} from "../services/fleet";
import { useConnectionStore } from "../store/useConnectionStore";
import { useFleetStore } from "../store/useFleetStore";

import { runConnectionRequest } from "./useConnectionRequest";

const AUTO_REFRESH_MS = 30_000;

export interface FleetDataResult {
  serverStatus: FleetServerStatusMetrics | null;
  agentVersions: FleetAgentVersionCount[];
  outputHealth: FleetOutputHealth[];
  agentInventory: ElasticAgentInfo[];
  agentInventoryTotal: number;
  actions: FleetAction[];
  actionResults: FleetActionResult[];
  partialErrors: string[];
}

/**
 * Fetches all Fleet data sources using React Query, replacing the manual
 * `useCallback` + `setInterval` + `AbortController` pattern that previously
 * lived in `FleetPage`.
 *
 * Results are synced into the Zustand fleet store so that existing UI
 * components continue to work unchanged.
 */
export function useFleetData() {
  const connection = useConnectionStore((s) => s.connection);
  const autoRefreshEnabled = useFleetStore((s) => s.autoRefreshEnabled);

  const query = useQuery({
    queryKey: ["fleet-data", connection?.url],
    queryFn: async (): Promise<FleetDataResult> => {
      const { data: results, error } = await runConnectionRequest({
        connection,
        run: (client) =>
          Promise.allSettled([
            loadFleetServerStatus(client),
            loadFleetAgentVersions(client),
            loadFleetOutputHealth(client),
            loadElasticAgentInventory(client),
            loadFleetActions(client),
            loadFleetActionResults(client),
          ]),
      });

      if (error !== null) {
        throw new Error(error);
      }

      if (results === null) {
        throw new Error("No active Elasticsearch connection");
      }

      const errors: string[] = [];
      const formatReason = (reason: unknown): string => {
        if (isElasticsearchError(reason)) return reason.message;
        if (reason instanceof Error) return reason.message;
        return String(reason);
      };
      const value = <T>(r: PromiseSettledResult<T>, label: string): T | null => {
        if (r.status === "fulfilled") return r.value;
        errors.push(`${label}: ${formatReason(r.reason)}`);
        return null;
      };

      const serverStatus = value(results[0]!, "Server status") ?? null;
      const agentVersions = value(results[1]!, "Agent versions") ?? [];
      const outputHealth = value(results[2]!, "Output health") ?? [];
      const inventoryResult = value(results[3]!, "Agent inventory");
      const agentInventory = inventoryResult?.agents ?? [];
      const agentInventoryTotal = inventoryResult?.total ?? 0;
      const actions = value(results[4]!, "Actions") ?? [];
      const actionResults = value(results[5]!, "Action results") ?? [];

      return {
        serverStatus,
        agentVersions,
        outputHealth,
        agentInventory,
        agentInventoryTotal,
        actions,
        actionResults,
        partialErrors: errors,
      };
    },
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: autoRefreshEnabled ? AUTO_REFRESH_MS : false,
  });

  // Sync React Query state into the Zustand store so existing UI components
  // continue to work without modification.
  useEffect(() => {
    useFleetStore.getState().setLoading(query.isFetching);
  }, [query.isFetching]);

  useEffect(() => {
    if (query.isError) {
      const msg = query.error instanceof Error ? query.error.message : String(query.error);
      useFleetStore.getState().setError(msg);
    } else {
      useFleetStore.getState().setError(null);
    }
  }, [query.isError, query.error]);

  useEffect(() => {
    if (!query.data) return;
    const store = useFleetStore.getState();
    store.setServerStatus(query.data.serverStatus);
    store.setAgentVersions(query.data.agentVersions);
    store.setOutputHealth(query.data.outputHealth);
    store.setAgentInventory(query.data.agentInventory);
    store.setAgentInventoryTotal(query.data.agentInventoryTotal);
    store.setActions(query.data.actions);
    store.setActionResults(query.data.actionResults);
    store.setPartialErrors(query.data.partialErrors);
    if (
      query.data.serverStatus ||
      query.data.agentInventory.length > 0 ||
      query.data.actions.length > 0
    ) {
      store.setLastUpdatedAt(Date.now());
    }
  }, [query.data]);

  return {
    refresh: () => void query.refetch(),
    loading: query.isFetching,
  };
}

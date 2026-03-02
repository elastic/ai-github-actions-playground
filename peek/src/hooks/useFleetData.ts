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
import { useFleetStore } from "../store/useFleetStore";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

const AUTO_REFRESH_MS = 30_000;

export interface FleetData {
  serverStatus: FleetServerStatusMetrics | null;
  agentVersions: FleetAgentVersionCount[];
  outputHealth: FleetOutputHealth[];
  agentInventory: ElasticAgentInfo[];
  agentInventoryTotal: number;
  actions: FleetAction[];
  actionResults: FleetActionResult[];
}

export interface UseFleetDataResult {
  data: FleetData;
  loading: boolean;
  error: string | null;
  partialErrors: string[];
  lastUpdatedAt: number | null;
  refresh: () => void;
}

const EMPTY_DATA: FleetData = {
  serverStatus: null,
  agentVersions: [],
  outputHealth: [],
  agentInventory: [],
  agentInventoryTotal: 0,
  actions: [],
  actionResults: [],
};

interface FleetQueryResult {
  data: FleetData;
  partialErrors: string[];
}

export function useFleetData(): UseFleetDataResult {
  const { connection, createQueryFn } = useEsQuery();
  const autoRefreshEnabled = useFleetStore((s) => s.autoRefreshEnabled);

  const query = useQuery({
    queryKey: ["fleet-data", connection?.url],
    queryFn: createQueryFn(async (client): Promise<FleetQueryResult> => {
      const results = await Promise.allSettled([
        loadFleetServerStatus(client),
        loadFleetAgentVersions(client),
        loadFleetOutputHealth(client),
        loadElasticAgentInventory(client),
        loadFleetActions(client),
        loadFleetActionResults(client),
      ]);

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

      const inventoryResult = value(results[3]!, "Agent inventory");

      return {
        data: {
          serverStatus: value(results[0]!, "Server status") ?? null,
          agentVersions: value(results[1]!, "Agent versions") ?? [],
          outputHealth: value(results[2]!, "Output health") ?? [],
          agentInventory: inventoryResult?.agents ?? [],
          agentInventoryTotal: inventoryResult?.total ?? 0,
          actions: value(results[4]!, "Actions") ?? [],
          actionResults: value(results[5]!, "Action results") ?? [],
        },
        partialErrors: errors,
      };
    }),
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: autoRefreshEnabled ? AUTO_REFRESH_MS : false,
  });
  useRefetchOnConnectionChange(connection, query.refetch);

  const refresh = () => {
    void query.refetch();
  };

  if (!connection) {
    return {
      data: EMPTY_DATA,
      loading: false,
      error: null,
      partialErrors: [],
      lastUpdatedAt: null,
      refresh,
    };
  }

  return {
    data: query.data?.data ?? EMPTY_DATA,
    loading: query.isFetching,
    error: query.isError
      ? query.error instanceof Error
        ? query.error.message
        : String(query.error)
      : null,
    partialErrors: query.data?.partialErrors ?? [],
    lastUpdatedAt: query.dataUpdatedAt > 0 ? query.dataUpdatedAt : null,
    refresh,
  };
}

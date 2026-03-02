import { useQuery } from "@tanstack/react-query";

import { isElasticsearchError } from "../services/es";
import {
  loadElasticAgentInfo,
  loadElasticAgentLogs,
  loadElasticAgentMetrics,
  type ElasticAgentInfo,
  type ElasticAgentLogEntry,
  type ElasticAgentMetricPoint,
} from "../services/fleet";
import type { DataFetchResult } from "../types/query";

import { useEsQuery } from "./useEsQuery";

export interface FleetAgentDetailData {
  agentInfo: ElasticAgentInfo | null;
  logs: ElasticAgentLogEntry[];
  metrics: ElasticAgentMetricPoint[];
}

export function useFleetAgentDetail(agentId: string): DataFetchResult<FleetAgentDetailData> & {
  refresh: () => void;
} {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: ["fleet-agent-detail", connection?.url, agentId],
    queryFn: createQueryFn(async (client) => {
      const [agent, agentLogs, agentMetrics] = await Promise.all([
        loadElasticAgentInfo(client, agentId),
        loadElasticAgentLogs(client, agentId, { size: 200 }),
        loadElasticAgentMetrics(client, agentId, 60),
      ]);
      const fallbackAgent =
        !agent && (agentLogs.length > 0 || agentMetrics.length > 0)
          ? {
              agentId,
              hostname: agentId,
              version: "unknown",
              os: null,
              lastSeen: agentLogs[0]?.timestamp ?? agentMetrics[0]?.timestamp ?? "",
              logCount: agentLogs.length,
              errorCount: agentLogs.filter((entry) => entry.level.toLowerCase() === "error").length,
            }
          : null;
      return {
        agentInfo: agent ?? fallbackAgent,
        logs: agentLogs,
        metrics: agentMetrics,
      };
    }),
    enabled: Boolean(connection && agentId),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const refresh = () => {
    void query.refetch();
  };

  if (!connection || !agentId) return { status: "idle", refresh };
  if (query.isFetching) return { status: "loading", refresh };
  if (query.isError) {
    const message = isElasticsearchError(query.error) ? query.error.message : String(query.error);
    return { status: "error", error: message, refresh };
  }
  if (query.data) return { status: "success", data: query.data, refresh };
  return { status: "idle", refresh };
}

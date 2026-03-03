import { useQuery } from "@tanstack/react-query";

import { isElasticsearchError } from "../services/es";
import { loadFleetServerStatus, loadElasticAgentInventory } from "../services/fleet";
import type { DataFetchResult } from "../types/query";
import { type OverviewData } from "../utils/clusterOverviewUtils";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

export interface ClusterOverviewResult {
  result: DataFetchResult<OverviewData>;
  partialErrors: string[];
  refresh: () => void;
}

export function useClusterOverview(): ClusterOverviewResult {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: ["cluster-overview", connection?.url],
    queryFn: createQueryFn((client) =>
      Promise.allSettled([
        client.getClusterInfo(),
        client.getClusterHealth(),
        client.getClusterStats(),
        client.getNodes(),
        client.getNodeStats(),
        client.getDataStreams(),
        client.resolveIndex("*"),
        loadFleetServerStatus(client),
        loadElasticAgentInventory(client),
      ]),
    ),
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    select: (results) => {
      const [
        clusterInfoResult,
        clusterHealthResult,
        clusterStatsResult,
        nodesResult,
        nodeStatsResult,
        dataStreamsResult,
        resolveIndexResult,
        fleetStatusResult,
        agentInventoryResult,
      ] = results;

      const data: OverviewData = {
        clusterInfo: clusterInfoResult.status === "fulfilled" ? clusterInfoResult.value : null,
        clusterHealth:
          clusterHealthResult.status === "fulfilled" ? clusterHealthResult.value : null,
        clusterStats: clusterStatsResult.status === "fulfilled" ? clusterStatsResult.value : null,
        nodesInfo: nodesResult.status === "fulfilled" ? nodesResult.value : null,
        nodesStats: nodeStatsResult.status === "fulfilled" ? nodeStatsResult.value : null,
        dataStreamCount:
          dataStreamsResult.status === "fulfilled"
            ? (dataStreamsResult.value.data_streams?.length ?? 0)
            : null,
        indexCount:
          resolveIndexResult.status === "fulfilled"
            ? (resolveIndexResult.value.indices?.length ?? 0)
            : null,
        aliasCount:
          resolveIndexResult.status === "fulfilled"
            ? (resolveIndexResult.value.aliases?.length ?? 0)
            : null,
        fleetStatus: fleetStatusResult.status === "fulfilled" ? fleetStatusResult.value : null,
        agentInventoryCount:
          agentInventoryResult.status === "fulfilled" ? agentInventoryResult.value.total : null,
      };

      const failedParts: string[] = [];
      if (clusterInfoResult.status === "rejected") failedParts.push("cluster info");
      if (clusterHealthResult.status === "rejected") failedParts.push("cluster health");
      if (clusterStatsResult.status === "rejected") failedParts.push("cluster stats");
      if (nodesResult.status === "rejected") failedParts.push("nodes");
      if (nodeStatsResult.status === "rejected") failedParts.push("node stats");
      if (dataStreamsResult.status === "rejected") failedParts.push("data streams");
      if (resolveIndexResult.status === "rejected") failedParts.push("indices/aliases");
      if (fleetStatusResult.status === "rejected") failedParts.push("fleet status");
      if (agentInventoryResult.status === "rejected") failedParts.push("agent inventory");

      if (failedParts.length === 9) {
        const firstError =
          clusterInfoResult.status === "rejected" ? clusterInfoResult.reason : null;
        throw new Error(
          isElasticsearchError(firstError)
            ? firstError.message
            : "Failed to load cluster overview data.",
        );
      }

      return { data, partialErrors: failedParts };
    },
  });
  useRefetchOnConnectionChange(connection, query.refetch);

  const refresh = () => {
    void query.refetch();
  };

  if (!connection) return { result: { status: "idle" }, partialErrors: [], refresh };
  if (query.isFetching)
    return {
      result: { status: "loading" },
      partialErrors: [],
      refresh,
    };
  if (query.isError)
    return { result: { status: "error", error: query.error.message }, partialErrors: [], refresh };
  if (query.data)
    return {
      result: { status: "success", data: query.data.data },
      partialErrors: query.data.partialErrors,
      refresh,
    };
  return { result: { status: "idle" }, partialErrors: [], refresh };
}

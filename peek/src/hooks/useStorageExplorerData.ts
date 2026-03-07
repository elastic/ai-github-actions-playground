import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { isElasticsearchError } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import type { DataFetchResult } from "../types/query";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

interface StorageNodeStats {
  name: string;
  totalBytes: number | null;
  availableBytes: number | null;
  usedBytes: number | null;
}

export interface StorageExplorerShard {
  node: string;
  index: string;
  shard: string;
  prirep: string;
  state: string;
  docs: number;
  storeBytes: number;
  dataStream: string | null;
  signal: string;
  dataset: string;
  namespace: string;
}

export interface StorageExplorerData {
  nodes: StorageNodeStats[];
  shards: StorageExplorerShard[];
}

interface StorageExplorerSelectResult {
  data: StorageExplorerData;
  partialErrors: string[];
}

export interface UseStorageExplorerDataResult {
  result: DataFetchResult<StorageExplorerData>;
  partialErrors: string[];
  refresh: () => void;
}

function parseIntOrZero(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDataStreamName(name: string | null): {
  signal: string;
  dataset: string;
  namespace: string;
} {
  if (!name) {
    return {
      signal: "indices",
      dataset: "standalone",
      namespace: "n/a",
    };
  }
  const firstDash = name.indexOf("-");
  const lastDash = name.lastIndexOf("-");
  if (firstDash <= 0 || lastDash <= firstDash || lastDash === name.length - 1) {
    return {
      signal: "indices",
      dataset: "standalone",
      namespace: "n/a",
    };
  }
  return {
    signal: name.slice(0, firstDash),
    dataset: name.slice(firstDash + 1, lastDash),
    namespace: name.slice(lastDash + 1),
  };
}

export function useStorageExplorerData(): UseStorageExplorerDataResult {
  const { connection, createQueryFn } = useEsQuery();
  const activeProfileId = useConnectionStore((s) => s.activeProfileId);
  const query = useQuery({
    queryKey: [
      "storage-explorer",
      activeProfileId,
      connection?.url,
      connection?.username ?? null,
      connection?.proxyUrl ?? null,
    ],
    queryFn: createQueryFn((client) =>
      Promise.allSettled([client.getCatShards(), client.getNodeStats(), client.getDataStreams()]),
    ),
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    select: (results): StorageExplorerSelectResult => {
      const [catShardsResult, nodeStatsResult, dataStreamsResult] = results;
      const partialErrors: string[] = [];

      if (catShardsResult.status === "rejected") partialErrors.push("cat shards");
      if (nodeStatsResult.status === "rejected") partialErrors.push("node stats");
      if (dataStreamsResult.status === "rejected") partialErrors.push("data streams");

      if (catShardsResult.status === "rejected") {
        const shardsError = catShardsResult.reason;
        throw new Error(
          isElasticsearchError(shardsError)
            ? shardsError.message
            : "Failed to load shard data for storage explorer.",
        );
      }

      if (partialErrors.length === 2) {
        const firstError =
          nodeStatsResult.status === "rejected"
            ? nodeStatsResult.reason
            : dataStreamsResult.status === "rejected"
              ? dataStreamsResult.reason
              : new Error("Failed to load storage explorer data.");
        throw new Error(
          isElasticsearchError(firstError)
            ? firstError.message
            : "Failed to load storage explorer data.",
        );
      }

      const dataStreamByBackingIndex = new Map<string, string>();
      if (dataStreamsResult.status === "fulfilled") {
        for (const stream of dataStreamsResult.value.data_streams ?? []) {
          for (const backingIndex of stream.indices ?? []) {
            const indexName = backingIndex.index_name;
            if (indexName) dataStreamByBackingIndex.set(indexName, stream.name);
          }
        }
      }

      const nodes: StorageNodeStats[] = [];
      if (nodeStatsResult.status === "fulfilled") {
        for (const [nodeId, nodeStats] of Object.entries(nodeStatsResult.value.nodes ?? {})) {
          const nodeName = nodeStats.name || nodeId;
          const totalBytes = nodeStats.fs?.total?.total_in_bytes ?? null;
          const availableBytes = nodeStats.fs?.total?.available_in_bytes ?? null;
          const usedBytes =
            totalBytes !== null && availableBytes !== null
              ? Math.max(0, totalBytes - availableBytes)
              : null;
          nodes.push({
            name: nodeName,
            totalBytes,
            availableBytes,
            usedBytes,
          });
        }
      }
      nodes.sort((a, b) => a.name.localeCompare(b.name));

      const shards: StorageExplorerShard[] = [];
      if (catShardsResult.status === "fulfilled") {
        for (const row of catShardsResult.value) {
          const node = row.node?.trim();
          const index = row.index?.trim();
          // Unassigned shards are intentionally excluded because this view is grouped by node.
          if (!node || !index) continue;

          const dataStream = dataStreamByBackingIndex.get(index) ?? null;
          const parts = parseDataStreamName(dataStream);
          shards.push({
            node,
            index,
            shard: row.shard ?? "0",
            prirep: row.prirep ?? "",
            state: row.state ?? "unknown",
            docs: parseIntOrZero(row.docs),
            storeBytes: parseIntOrZero(row.store),
            dataStream,
            signal: parts.signal,
            dataset: parts.dataset,
            namespace: parts.namespace,
          });
        }
      }

      return {
        data: {
          nodes,
          shards,
        },
        partialErrors,
      };
    },
  });
  useRefetchOnConnectionChange(connection, query.refetch);

  const refresh = () => {
    void query.refetch();
  };

  const result = useMemo<DataFetchResult<StorageExplorerData>>(() => {
    if (!connection) return { status: "idle" };
    if (query.isPending) return { status: "loading" };
    if (query.data) return { status: "success", data: query.data.data };
    if (query.isError) return { status: "error", error: query.error.message };
    return { status: "idle" };
  }, [connection, query.data, query.error, query.isError, query.isPending]);

  return {
    result,
    partialErrors: query.data?.partialErrors ?? [],
    refresh,
  };
}

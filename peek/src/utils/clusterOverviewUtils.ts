import {
  type ClusterHealthResponse,
  type ClusterInfoResponse,
  type ClusterStatsResponse,
  type NodesInfoResponse,
  type NodesStatsResponse,
  type NodesInfoNode,
  type NodeStatsNode,
} from "../services/es";
import { type FleetServerStatusMetrics } from "../services/fleet";

export interface OverviewData {
  clusterInfo: ClusterInfoResponse | null;
  clusterHealth: ClusterHealthResponse | null;
  clusterStats: ClusterStatsResponse | null;
  nodesInfo: NodesInfoResponse | null;
  nodesStats: NodesStatsResponse | null;
  dataStreamCount: number | null;
  indexCount: number | null;
  aliasCount: number | null;
  fleetStatus: FleetServerStatusMetrics | null;
  agentInventoryCount: number | null;
}

export interface NodeRow {
  id: string;
  name: string;
  roles: string[];
  cpuPercent: number | null;
  heapPercent: number | null;
  diskUsedPercent: number | null;
  shardCount: number | null;
  docCount: number | null;
}

export function formatCompactNumber(value: number | null): string {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatPercent(value: number | null): string {
  if (value === null) return "Unavailable";
  return `${value.toFixed(0)}%`;
}

export function toNodeRows(
  nodesInfo: NodesInfoResponse | null,
  nodesStats: NodesStatsResponse | null,
): NodeRow[] {
  const infoById = nodesInfo?.nodes ?? {};
  const statsById = nodesStats?.nodes ?? {};
  const ids = Array.from(new Set([...Object.keys(infoById), ...Object.keys(statsById)])).sort();

  return ids.map((id) => {
    const info: NodesInfoNode | undefined = infoById[id];
    const stats: NodeStatsNode | undefined = statsById[id];
    const totalBytes = stats?.fs?.total?.total_in_bytes;
    const availableBytes = stats?.fs?.total?.available_in_bytes;
    const diskUsedPercent =
      totalBytes && totalBytes > 0 && availableBytes !== undefined
        ? ((totalBytes - availableBytes) / totalBytes) * 100
        : null;

    return {
      id,
      name: info?.name ?? stats?.name ?? id,
      roles: info?.roles ?? [],
      cpuPercent: stats?.os?.cpu?.percent ?? null,
      heapPercent: stats?.jvm?.mem?.heap_used_percent ?? null,
      diskUsedPercent,
      shardCount: stats?.indices?.shard_stats?.total_count ?? null,
      docCount: stats?.indices?.docs?.count ?? null,
    };
  });
}

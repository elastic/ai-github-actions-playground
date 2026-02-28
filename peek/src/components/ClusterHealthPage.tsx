import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { runConnectionRequest } from "../hooks/useConnectionRequest";
import {
  type CatAllocationRecord,
  type CatShardRecord,
  type ClusterHealthResponse,
  type ClusterPendingTasksResponse,
  type ClusterStatsResponse,
  type IlmExplainResponse,
  type NodesIngestStatsResponse,
  type NodesStatsResponse,
  type RecoveryResponse,
  type SlmStatsResponse,
  type SnapshotStatusResponse,
} from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";

interface PhaseData {
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
  ingestStats: NodesIngestStatsResponse | null;
}

function InfoCard({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      <Typography variant="h5">{value}</Typography>
      {detail ? (
        <Typography variant="body2" color="text.secondary">
          {detail}
        </Typography>
      ) : null}
    </Paper>
  );
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ClusterHealthPage() {
  const connection = useConnectionStore((s) => s.connection);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialErrors, setPartialErrors] = useState<string[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [data, setData] = useState<PhaseData>({
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
    ingestStats: null,
  });

  const loadData = useCallback(async () => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    setPartialErrors([]);
    try {
      const { data: results, error: requestError } = await runConnectionRequest({
        connection,
        run: (client) =>
          Promise.allSettled([
            client.getClusterHealth("indices"),
            client.getPendingTasks(),
            client.getCatAllocation(),
            client.getClusterStats(),
            client.getNodeStats(),
            client.getCatShards(),
            client.getRecoveryStatus(),
            client.getIlmExplainAll(),
            client.getSlmStats(),
            client.getSnapshotStatus(),
            client.getNodeIngestStats(),
          ]),
      });
      if (requestError !== null) {
        setError(requestError);
        return;
      }
      if (results === null) return;

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
        ingestStats,
      ] = results;

      setData({
        clusterHealth: clusterHealth.status === "fulfilled" ? clusterHealth.value : null,
        pendingTasks: pendingTasks.status === "fulfilled" ? pendingTasks.value : null,
        allocation: allocation.status === "fulfilled" ? allocation.value : null,
        clusterStats: clusterStats.status === "fulfilled" ? clusterStats.value : null,
        nodeStats: nodeStats.status === "fulfilled" ? nodeStats.value : null,
        shards: shards.status === "fulfilled" ? shards.value : null,
        recovery: recovery.status === "fulfilled" ? recovery.value : null,
        ilm: ilm.status === "fulfilled" ? ilm.value : null,
        slm: slm.status === "fulfilled" ? slm.value : null,
        snapshots: snapshots.status === "fulfilled" ? snapshots.value : null,
        ingestStats: ingestStats.status === "fulfilled" ? ingestStats.value : null,
      });

      const failures: string[] = [];
      if (clusterHealth.status === "rejected") failures.push("cluster health");
      if (pendingTasks.status === "rejected") failures.push("pending tasks");
      if (allocation.status === "rejected") failures.push("allocation");
      if (clusterStats.status === "rejected") failures.push("cluster stats");
      if (nodeStats.status === "rejected") failures.push("node stats");
      if (shards.status === "rejected") failures.push("shards");
      if (recovery.status === "rejected") failures.push("recovery");
      if (ilm.status === "rejected") failures.push("ILM");
      if (slm.status === "rejected") failures.push("SLM");
      if (snapshots.status === "rejected") failures.push("snapshots");
      if (ingestStats.status === "rejected") failures.push("ingest stats");
      setPartialErrors(failures);
      setLastUpdatedAt(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const pendingTaskCount = data.pendingTasks?.tasks?.length ?? 0;
  const hotNodes = (data.allocation ?? []).filter(
    (entry) => parseNumber(entry["disk.percent"]) >= 85,
  ).length;
  const nodeValues = Object.values(data.nodeStats?.nodes ?? {});
  const avgCpu =
    nodeValues.length > 0
      ? Math.round(
          nodeValues.reduce((sum, node) => sum + (node.os?.cpu?.percent ?? 0), 0) /
            nodeValues.length,
        )
      : 0;
  const avgHeap =
    nodeValues.length > 0
      ? Math.round(
          nodeValues.reduce((sum, node) => sum + (node.jvm?.mem?.heap_used_percent ?? 0), 0) /
            nodeValues.length,
        )
      : 0;
  const shardSkew = useMemo(() => {
    const perNode = new Map<string, number>();
    for (const shard of data.shards ?? []) {
      const node = shard.node ?? "unknown";
      perNode.set(node, (perNode.get(node) ?? 0) + 1);
    }
    const counts = Array.from(perNode.values());
    if (counts.length === 0) return 0;
    return Math.max(...counts) - Math.min(...counts);
  }, [data.shards]);
  const activeRecoveries =
    Object.values(data.recovery ?? {}).reduce(
      (sum, shardStatuses) => sum + shardStatuses.length,
      0,
    ) ?? 0;
  const ilmWarnings = Object.values(data.ilm?.indices ?? {}).filter((entry) =>
    Boolean(entry.failed_step),
  ).length;
  const slmFailures =
    data.slm?.policy_stats?.reduce((sum, policy) => sum + (policy.snapshots_failed ?? 0), 0) ?? 0;
  const snapshotFailures =
    data.snapshots?.snapshots?.reduce(
      (sum, snapshot) => sum + (snapshot.shards_stats?.failed ?? 0),
      0,
    ) ?? 0;
  const ingestFailures =
    Object.values(data.ingestStats?.nodes ?? {}).reduce(
      (sum, node) => sum + (node.ingest?.total?.failed ?? 0),
      0,
    ) ?? 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" component="h1" sx={{ flex: 1 }}>
            Cluster Health
          </Typography>
          {lastUpdatedAt ? (
            <Typography variant="caption" color="text.secondary">
              Last update: {new Date(lastUpdatedAt).toLocaleTimeString()}
            </Typography>
          ) : null}
          <Button size="small" variant="outlined" onClick={loadData} disabled={loading}>
            {loading ? <CircularProgress size={16} /> : "Refresh"}
          </Button>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {!error && partialErrors.length > 0 ? (
        <Alert severity="warning">
          Partial data loaded. Unavailable: {partialErrors.join(", ")}.
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Phase 1 — Real-time health
        </Typography>
        <Stack direction="row" spacing={2}>
          <InfoCard
            title="Cluster status"
            value={(data.clusterHealth?.status ?? "unknown").toUpperCase()}
          />
          <InfoCard title="Pending tasks" value={pendingTaskCount.toString()} />
          <InfoCard
            title="Hot disk nodes"
            value={hotNodes.toString()}
            detail="nodes at or above 85% disk"
          />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Phase 2 — Capacity pressure
        </Typography>
        <Stack direction="row" spacing={2}>
          <InfoCard title="Avg CPU" value={`${avgCpu}%`} />
          <InfoCard title="Avg heap" value={`${avgHeap}%`} />
          <InfoCard
            title="Shard skew"
            value={shardSkew.toString()}
            detail="max-min shards per node"
          />
          <InfoCard
            title="Total indices"
            value={(data.clusterStats?.indices?.count ?? 0).toLocaleString()}
          />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Phase 3 — Resilience signals
        </Typography>
        <Stack direction="row" spacing={2}>
          <InfoCard title="Active recoveries" value={activeRecoveries.toString()} />
          <InfoCard title="ILM warnings" value={ilmWarnings.toString()} />
          <InfoCard title="SLM failures" value={slmFailures.toString()} />
          <InfoCard title="Snapshot failures" value={snapshotFailures.toString()} />
          <InfoCard title="Ingest failures" value={ingestFailures.toString()} />
        </Stack>
      </Paper>
    </Box>
  );
}

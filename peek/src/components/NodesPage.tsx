import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LoadingButton from "./LoadingButton";

import { useClusterOverview } from "../hooks/useClusterOverview";

import PageContainer from "./PageContainer";
import PageHeaderSection from "./PageHeaderSection";
import DocLink from "./DocLink";
import { NodesTable } from "./nodes/NodesTable";

import {
  percentLevel,
  computeSummary,
  NODE_THRESHOLDS,
  type MetricLevel,
  type NodeTableRow,
} from "./nodes/nodeTableHelpers";

function MetricChip({
  label,
  value,
  level = "ok",
}: {
  label: string;
  value: string;
  level?: MetricLevel;
}) {
  return (
    <Chip
      size="small"
      variant={level === "ok" ? "outlined" : "filled"}
      color={level === "critical" ? "error" : level === "warning" ? "warning" : "default"}
      label={`${label}: ${value}`}
    />
  );
}

export default function NodesPage() {
  const navigate = useNavigate();
  const { result, partialErrors, refresh } = useClusterOverview();
  const loading = result.status === "loading";
  const error = result.status === "error" ? result.error : null;
  const data = result.status === "success" ? result.data : null;
  const nodeDataUnavailable =
    partialErrors.includes("nodes") && partialErrors.includes("node stats");

  const rows = useMemo<NodeTableRow[]>(() => {
    const infoNodes = data?.nodesInfo?.nodes ?? {};
    const statsNodes = data?.nodesStats?.nodes ?? {};
    const ids = Array.from(new Set([...Object.keys(infoNodes), ...Object.keys(statsNodes)])).sort();

    return ids.map((id) => {
      const info = infoNodes[id];
      const stats = statsNodes[id];
      const totalFs = stats?.fs?.total?.total_in_bytes;
      const availFs = stats?.fs?.total?.available_in_bytes;
      const fsUsedPercent =
        totalFs && totalFs > 0 && availFs !== undefined
          ? ((totalFs - availFs) / totalFs) * 100
          : null;
      const rejections = stats?.thread_pool
        ? Object.values(stats.thread_pool).reduce((sum, p) => sum + (p.rejected ?? 0), 0)
        : null;
      const trips = stats?.breakers
        ? Object.values(stats.breakers).reduce((sum, b) => sum + (b.tripped ?? 0), 0)
        : null;

      return {
        id,
        name: info?.name ?? stats?.name ?? id,
        transportAddress: info?.transport_address ?? null,
        roles:
          info?.roles && info.roles.length > 0 ? info.roles : info ? ["coordinating_only"] : [],
        version: info?.version ?? "unknown",
        cpuPercent: stats?.os?.cpu?.percent ?? null,
        load1m: stats?.os?.cpu?.load_average?.["1m"] ?? null,
        heapPercent: stats?.jvm?.mem?.heap_used_percent ?? null,
        gcOldCount: stats?.jvm?.gc?.collectors?.old?.collection_count ?? null,
        gcOldMs: stats?.jvm?.gc?.collectors?.old?.collection_time_in_millis ?? null,
        fsUsedPercent,
        totalThreadRejections: rejections,
        totalBreakerTrips: trips,
        docCount: stats?.indices?.docs?.count ?? null,
        shardCount: stats?.indices?.shard_stats?.total_count ?? null,
      };
    });
  }, [data?.nodesInfo?.nodes, data?.nodesStats?.nodes]);

  const summary = useMemo(() => computeSummary(rows), [rows]);

  return (
    <PageContainer>
      <PageHeaderSection
        title="Nodes"
        titleAdornment={<DocLink section="nodes" tooltip="Nodes docs" />}
        description="Runtime health and capacity for all Elasticsearch nodes. Click a row to drill into thread pools, circuit breakers, and more."
        actions={
          <LoadingButton size="small" variant="outlined" onClick={refresh} loading={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </LoadingButton>
        }
      />

      {error && <Alert severity="error">{error}</Alert>}
      {!error && partialErrors.length > 0 && (
        <Alert severity="warning">
          Partial data loaded. Unavailable: {partialErrors.join(", ")}.
        </Alert>
      )}

      {!error && rows.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 0.5 }}>
          <MetricChip label="Nodes" value={summary.count.toLocaleString()} />
          <MetricChip
            label="CPU max"
            value={summary.maxCpu !== null ? `${summary.maxCpu.toFixed(0)}%` : "n/a"}
            level={
              summary.maxCpu !== null
                ? percentLevel(
                    summary.maxCpu,
                    NODE_THRESHOLDS.cpu.warning,
                    NODE_THRESHOLDS.cpu.critical,
                  )
                : "ok"
            }
          />
          <MetricChip
            label="CPU avg"
            value={summary.avgCpu !== null ? `${summary.avgCpu.toFixed(0)}%` : "n/a"}
            level={
              summary.avgCpu !== null
                ? percentLevel(
                    summary.avgCpu,
                    NODE_THRESHOLDS.cpu.warning,
                    NODE_THRESHOLDS.cpu.critical,
                  )
                : "ok"
            }
          />
          <MetricChip
            label="Heap max"
            value={summary.maxHeap !== null ? `${summary.maxHeap.toFixed(0)}%` : "n/a"}
            level={
              summary.maxHeap !== null
                ? percentLevel(
                    summary.maxHeap,
                    NODE_THRESHOLDS.heap.warning,
                    NODE_THRESHOLDS.heap.critical,
                  )
                : "ok"
            }
          />
          <MetricChip
            label="Heap avg"
            value={summary.avgHeap !== null ? `${summary.avgHeap.toFixed(0)}%` : "n/a"}
            level={
              summary.avgHeap !== null
                ? percentLevel(
                    summary.avgHeap,
                    NODE_THRESHOLDS.heap.warning,
                    NODE_THRESHOLDS.heap.critical,
                  )
                : "ok"
            }
          />
          <MetricChip
            label="Disk max"
            value={summary.maxDisk !== null ? `${summary.maxDisk.toFixed(0)}%` : "n/a"}
            level={
              summary.maxDisk !== null
                ? percentLevel(
                    summary.maxDisk,
                    NODE_THRESHOLDS.disk.warning,
                    NODE_THRESHOLDS.disk.critical,
                  )
                : "ok"
            }
          />
          <MetricChip
            label="Disk avg"
            value={summary.avgDisk !== null ? `${summary.avgDisk.toFixed(0)}%` : "n/a"}
            level={
              summary.avgDisk !== null
                ? percentLevel(
                    summary.avgDisk,
                    NODE_THRESHOLDS.disk.warning,
                    NODE_THRESHOLDS.disk.critical,
                  )
                : "ok"
            }
          />
          <MetricChip
            label="Docs"
            value={summary.totalDocs !== null ? summary.totalDocs.toLocaleString() : "n/a"}
          />
          <MetricChip
            label="Shards"
            value={summary.totalShards !== null ? summary.totalShards.toLocaleString() : "n/a"}
          />
        </Box>
      )}

      {!error && (
        <NodesTable
          rows={rows}
          loading={loading}
          nodeDataUnavailable={nodeDataUnavailable}
          onRowClick={(id) => navigate(`/nodes/${encodeURIComponent(id)}`)}
        />
      )}
    </PageContainer>
  );
}

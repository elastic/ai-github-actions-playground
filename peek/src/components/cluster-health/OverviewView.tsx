import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { ClusterHealthData } from "../../hooks/useClusterHealthData";

import {
  isAllocationDisabled,
  percentSeverity,
  totalCircuitBreakerTrips,
  totalThreadPoolRejections,
} from "./clusterHealthUtils";
import InfoCard from "./InfoCard";

interface OverviewViewProps {
  data: ClusterHealthData;
}

export default function OverviewView({ data }: OverviewViewProps) {
  const nodeValues = Object.values(data.nodeStats?.nodes ?? {});

  const status = data.clusterHealth?.status ?? "unknown";
  const shardPct = data.clusterHealth?.active_shards_percent_as_number;
  const shardPctStr = shardPct != null ? `${shardPct.toFixed(1)}%` : "—";
  const statusColor =
    status === "green"
      ? "success"
      : status === "yellow"
        ? "warning"
        : status === "red"
          ? "error"
          : "default";

  const unassigned = data.clusterHealth?.unassigned_shards ?? 0;
  const pending = data.pendingTasks?.tasks?.length ?? 0;

  const avgCpu =
    nodeValues.length > 0
      ? Math.round(
          nodeValues.reduce((s, n) => s + (n.os?.cpu?.percent ?? 0), 0) / nodeValues.length,
        )
      : 0;
  const avgHeap =
    nodeValues.length > 0
      ? Math.round(
          nodeValues.reduce((s, n) => s + (n.jvm?.mem?.heap_used_percent ?? 0), 0) /
            nodeValues.length,
        )
      : 0;

  const rejections = totalThreadPoolRejections(data.nodeStats?.nodes);
  const trips = totalCircuitBreakerTrips(data.nodeStats?.nodes);
  const allocationOff = isAllocationDisabled(data.clusterSettings);

  const activeRecoveries = Object.values(data.recovery ?? {}).reduce(
    (sum, ir) => sum + (ir.shards?.length ?? 0),
    0,
  );

  return (
    <>
      {allocationOff ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Shard allocation is disabled or restricted. Check{" "}
          <code>cluster.routing.allocation.enable</code>.
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Chip
          label={status.toUpperCase()}
          color={statusColor as "success" | "warning" | "error" | "default"}
          size="small"
        />
        <Typography variant="body2" color="text.secondary">
          Active shards: {shardPctStr}
        </Typography>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ flexWrap: "wrap" }}>
        <InfoCard
          title="Nodes"
          value={(data.clusterHealth?.number_of_nodes ?? nodeValues.length).toLocaleString()}
          detail={`${data.clusterHealth?.number_of_data_nodes ?? 0} data`}
        />
        <InfoCard
          title="Unassigned shards"
          value={unassigned.toLocaleString()}
          severity={unassigned > 0 ? "error" : "success"}
        />
        <InfoCard
          title="Pending tasks"
          value={pending.toString()}
          severity={pending >= 10 ? "warning" : undefined}
        />
        <InfoCard title="Avg CPU" value={`${avgCpu}%`} severity={percentSeverity(avgCpu, 75, 90)} />
        <InfoCard
          title="Avg heap"
          value={`${avgHeap}%`}
          severity={percentSeverity(avgHeap, 75, 90)}
        />
        <InfoCard
          title="Thread pool rejections"
          value={rejections.toLocaleString()}
          detail="write + search + get"
          severity={rejections > 0 ? "warning" : "success"}
        />
        <InfoCard
          title="Circuit breaker trips"
          value={trips.toLocaleString()}
          severity={trips > 0 ? "error" : "success"}
        />
        <InfoCard title="Active recoveries" value={activeRecoveries.toString()} />
      </Stack>

      {unassigned > 0 && data.allocationExplain ? (
        <>
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Allocation Explain
          </Typography>
          <Alert severity="info" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
            <strong>Index:</strong> {data.allocationExplain.index} &nbsp;
            <strong>Shard:</strong> {data.allocationExplain.shard} &nbsp;
            <strong>Primary:</strong> {data.allocationExplain.primary ? "yes" : "no"}
            <br />
            <strong>Reason:</strong> {data.allocationExplain.unassigned_info?.reason ?? "unknown"}
            <br />
            <strong>Explanation:</strong> {data.allocationExplain.allocate_explanation ?? "—"}
          </Alert>
        </>
      ) : null}
    </>
  );
}

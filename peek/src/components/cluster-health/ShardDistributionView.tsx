import { useMemo } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { ClusterHealthData } from "../../hooks/useClusterHealthData";

import { groupUnassignedReasons } from "./clusterHealthUtils";
import InfoCard from "./InfoCard";

interface ShardDistributionViewProps {
  data: ClusterHealthData;
}

export default function ShardDistributionView({ data }: ShardDistributionViewProps) {
  const shards = useMemo(() => data.shards ?? [], [data.shards]);
  const totalShards = shards.length;
  const startedShards = shards.filter((s) => s.state === "STARTED").length;
  const unassigned = data.clusterHealth?.unassigned_shards ?? 0;
  const initializing = data.clusterHealth?.initializing_shards ?? 0;
  const relocating = data.clusterHealth?.relocating_shards ?? 0;

  const primaryShards = shards.filter((s) => s.prirep === "p").length;
  const replicaShards = shards.filter((s) => s.prirep === "r").length;
  const ratio = replicaShards > 0 ? (primaryShards / replicaShards).toFixed(2) : "n/a";

  const shardSkew = useMemo(() => {
    const perNode = new Map<string, number>();
    for (const shard of shards) {
      if (shard.node) {
        perNode.set(shard.node, (perNode.get(shard.node) ?? 0) + 1);
      }
    }
    const counts = Array.from(perNode.values());
    if (counts.length === 0) return 0;
    return Math.max(...counts) - Math.min(...counts);
  }, [shards]);

  const unassignedReasons = useMemo(() => groupUnassignedReasons(shards), [shards]);

  return (
    <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ flexWrap: "wrap" }}>
        <InfoCard title="Total shards" value={totalShards.toLocaleString()} />
        <InfoCard title="Started shards" value={startedShards.toLocaleString()} />
        <InfoCard title="Initializing" value={initializing.toLocaleString()} />
        <InfoCard title="Relocating" value={relocating.toLocaleString()} />
        <InfoCard
          title="Unassigned"
          value={unassigned.toLocaleString()}
          severity={unassigned > 0 ? "error" : "success"}
        />
        <InfoCard title="Shard skew" value={shardSkew.toString()} detail="max-min per node" />
        <InfoCard title="Primary/replica ratio" value={ratio} />
      </Stack>

      {unassignedReasons.size > 0 ? (
        <>
          <Typography variant="body2" sx={{ mt: 3, mb: 1 }}>
            Unassigned Shard Reasons
          </Typography>
          {Array.from(unassignedReasons.entries())
            .sort(([, a], [, b]) => b - a)
            .map(([reason, count]) => (
              <Typography key={reason} variant="body2" color="text.secondary">
                {reason}: {count} shard{count !== 1 ? "s" : ""}
              </Typography>
            ))}
        </>
      ) : null}
    </>
  );
}

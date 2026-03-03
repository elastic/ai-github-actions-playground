import { useMemo } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { ClusterHealthData } from "../../hooks/useClusterHealthData";

import InfoCard, { type InfoCardSeverity } from "./InfoCard";

interface ResilienceSignalsViewProps {
  data: ClusterHealthData;
}

export default function ResilienceSignalsView({ data }: ResilienceSignalsViewProps) {
  const nodeValues = Object.values(data.nodeStats?.nodes ?? {});

  // Cluster health
  const healthStatus = data.clusterHealth?.status ?? "unknown";
  const healthSeverity: InfoCardSeverity | undefined =
    healthStatus === "red"
      ? "error"
      : healthStatus === "yellow"
        ? "warning"
        : healthStatus === "green"
          ? "success"
          : undefined;
  const unassignedShards = data.clusterHealth?.unassigned_shards ?? 0;

  // Recovery
  const recoveringIndices = Object.keys(data.recovery ?? {}).length;
  const activeRecoveries = Object.values(data.recovery ?? {}).reduce(
    (sum, ir) => sum + (ir.shards?.length ?? 0),
    0,
  );
  const stuckShards = Object.values(data.recovery ?? {}).reduce(
    (sum, ir) =>
      sum + (ir.shards ?? []).filter((s) => (s.stage ?? "").toUpperCase() !== "DONE").length,
    0,
  );

  // ILM
  const ilmIndicesObj = data.ilm?.indices;
  const ilmIndices = Object.entries(ilmIndicesObj ?? {});
  const ilmWarnings = ilmIndices.filter(([, e]) => Boolean(e.failed_step)).length;
  const ilmPhases = useMemo(() => {
    const phases = new Map<string, number>();
    for (const entry of Object.values(ilmIndicesObj ?? {})) {
      const phase = entry.phase ?? "unknown";
      phases.set(phase, (phases.get(phase) ?? 0) + 1);
    }
    return phases;
  }, [ilmIndicesObj]);

  // SLM
  const slmFailures =
    data.slm?.policy_stats?.reduce((sum, p) => sum + (p.snapshots_failed ?? 0), 0) ?? 0;

  // Snapshots
  const snapshotFailures =
    data.snapshots?.snapshots?.reduce((sum, s) => sum + (s.shards_stats?.failed ?? 0), 0) ?? 0;

  // Ingest (read from nodeStats which now includes ingest metrics)
  const ingestFailures = nodeValues.reduce((sum, n) => sum + (n.ingest?.total?.failed ?? 0), 0);

  // Indexing / Search
  const indexingOps = nodeValues.reduce(
    (sum, n) => sum + (n.indices?.indexing?.index_total ?? 0),
    0,
  );
  const queryOps = nodeValues.reduce((sum, n) => sum + (n.indices?.search?.query_total ?? 0), 0);
  const queryTimeMs = nodeValues.reduce(
    (sum, n) => sum + (n.indices?.search?.query_time_in_millis ?? 0),
    0,
  );
  const queryLatency = queryOps > 0 ? Math.round((queryTimeMs / queryOps) * 100) / 100 : 0;

  return (
    <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ flexWrap: "wrap" }}>
        <InfoCard
          title="Cluster health"
          value={healthStatus.toUpperCase()}
          severity={healthSeverity}
        />
        <InfoCard
          title="Unassigned shards"
          value={unassignedShards.toLocaleString()}
          severity={unassignedShards > 0 ? "error" : "success"}
        />
        <InfoCard title="Recovering indices" value={recoveringIndices.toString()} />
        <InfoCard title="Active recoveries" value={activeRecoveries.toString()} />
        <InfoCard
          title="Recovery stuck shards"
          value={stuckShards.toString()}
          severity={stuckShards > 0 ? "warning" : undefined}
        />
        <InfoCard
          title="ILM warnings"
          value={ilmWarnings.toString()}
          severity={ilmWarnings > 0 ? "warning" : undefined}
        />
        <InfoCard
          title="SLM failures"
          value={slmFailures.toString()}
          severity={slmFailures > 0 ? "warning" : undefined}
        />
        <InfoCard
          title="Snapshot failures"
          value={snapshotFailures.toString()}
          severity={snapshotFailures > 0 ? "warning" : undefined}
        />
        <InfoCard
          title="Ingest failures"
          value={ingestFailures.toString()}
          severity={ingestFailures > 0 ? "warning" : undefined}
        />
        <InfoCard
          title="Indexing ops"
          value={indexingOps.toLocaleString()}
          detail="lifetime total"
        />
        <InfoCard title="Search ops" value={queryOps.toLocaleString()} detail="lifetime total" />
        <InfoCard title="Search latency" value={`${queryLatency}ms`} detail="avg ms/query" />
      </Stack>

      {ilmPhases.size > 0 ? (
        <>
          <Typography variant="body2" sx={{ mt: 3, mb: 1 }}>
            ILM Phase Distribution
          </Typography>
          {Array.from(ilmPhases.entries())
            .sort(([, a], [, b]) => b - a)
            .map(([phase, count]) => (
              <Typography key={phase} variant="body2" color="text.secondary">
                {phase}: {count} {count === 1 ? "index" : "indices"}
              </Typography>
            ))}
        </>
      ) : null}
    </>
  );
}

import { useMemo } from "react";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";

import type { ClusterHealthData } from "../../hooks/useClusterHealthData";
import { useTableSort } from "../../hooks/useTableSort";

import { groupUnassignedReasons } from "./clusterHealthUtils";
import InfoCard from "./InfoCard";
import NodeShardTable from "./NodeShardTable";

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

  const nodeDistribution = useMemo(() => {
    const map = new Map<string, { primary: number; replica: number; total: number }>();
    for (const shard of shards) {
      if (shard.node) {
        if (!map.has(shard.node)) map.set(shard.node, { primary: 0, replica: 0, total: 0 });
        const entry = map.get(shard.node)!;
        entry.total++;
        if (shard.prirep === "p") {
          entry.primary++;
        } else if (shard.prirep === "r") {
          entry.replica++;
        }
      }
    }
    return Array.from(map.entries()).map(([node, counts]) => ({ node, ...counts }));
  }, [shards]);

  const shardSkew = useMemo(() => {
    const counts = nodeDistribution.map((n) => n.total);
    if (counts.length === 0) return 0;
    return Math.max(...counts) - Math.min(...counts);
  }, [nodeDistribution]);

  const unassignedReasons = useMemo(() => groupUnassignedReasons(shards), [shards]);

  // Shard distribution per index
  type SortKey = "index" | "primary" | "replica" | "unassigned";
  const {
    sortField: sortKey,
    sortDirection: sortDir,
    getSortLabelProps,
  } = useTableSort<SortKey>("index", "asc", {
    fieldDefaults: { primary: "desc", replica: "desc", unassigned: "desc" },
  });

  const indexDistribution = useMemo(() => {
    const map = new Map<string, { primary: number; replica: number; unassigned: number }>();
    for (const shard of shards) {
      const indexName = shard.index ?? "unknown";
      if (!map.has(indexName)) map.set(indexName, { primary: 0, replica: 0, unassigned: 0 });
      const entry = map.get(indexName)!;
      if (shard.state === "UNASSIGNED") {
        entry.unassigned++;
      } else if (shard.prirep === "p") {
        entry.primary++;
      } else {
        entry.replica++;
      }
    }
    return Array.from(map.entries()).map(([index, counts]) => ({ index, ...counts }));
  }, [shards]);

  const sortedDistribution = useMemo(() => {
    const rows = [...indexDistribution];
    rows.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "index") return mul * a.index.localeCompare(b.index);
      return mul * (a[sortKey] - b[sortKey]);
    });
    return rows;
  }, [indexDistribution, sortKey, sortDir]);

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

      {indexDistribution.length > 0 ? (
        <>
          <Typography variant="body2" sx={{ mt: 3, mb: 1 }}>
            Shard Distribution by Index
          </Typography>
          <TableContainer>
            <Table size="small" aria-label="Shard Distribution by Index">
              <TableHead>
                <TableRow>
                  {(
                    [
                      ["index", "Index"],
                      ["primary", "Primary"],
                      ["replica", "Replica"],
                      ["unassigned", "Unassigned"],
                    ] as const
                  ).map(([key, label]) => (
                    <TableCell
                      key={key}
                      align={key === "index" ? undefined : "right"}
                      sortDirection={sortKey === key ? sortDir : false}
                    >
                      <TableSortLabel {...getSortLabelProps(key)}>{label}</TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedDistribution.map((row) => (
                  <TableRow key={row.index}>
                    <TableCell>{row.index}</TableCell>
                    <TableCell align="right">{row.primary}</TableCell>
                    <TableCell align="right">{row.replica}</TableCell>
                    <TableCell
                      align="right"
                      sx={
                        row.unassigned > 0 ? { color: "error.main", fontWeight: "bold" } : undefined
                      }
                    >
                      {row.unassigned}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : null}

      {nodeDistribution.length > 0 ? <NodeShardTable rows={nodeDistribution} /> : null}

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

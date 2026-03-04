import { useMemo } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { OverviewInfoCard } from "../OverviewInfoCard";

import type { ClusterRow, NamespaceRow, PodRow, WorkloadRow } from "./k8sHelpers";

interface K8sOverviewCardsProps {
  clusterRows: ClusterRow[];
  namespaceRows: NamespaceRow[];
  workloadRows: WorkloadRow[];
  podRows: PodRow[];
}

function formatCpu(value: number | null): string {
  if (value == null) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function formatMemory(bytes: number | null): string {
  if (bytes == null) return "N/A";
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GiB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

export default function K8sOverviewCards({
  clusterRows,
  namespaceRows,
  workloadRows,
  podRows,
}: K8sOverviewCardsProps) {
  const summary = useMemo(() => {
    const totalClusters = clusterRows.length;
    const totalNamespaces = namespaceRows.length;
    const totalWorkloads = workloadRows.length;
    const totalPods = podRows.length;

    const allRows = [
      ...clusterRows.map((r) => ({ cpu: r.avgCpu, mem: r.avgMemory })),
      ...namespaceRows.map((r) => ({ cpu: r.avgCpu, mem: r.avgMemory })),
      ...workloadRows.map((r) => ({ cpu: r.avgCpu, mem: r.avgMemory })),
      ...podRows.map((r) => ({ cpu: r.avgCpu, mem: r.avgMemory })),
    ];
    const cpuValues = allRows.map((r) => r.cpu).filter((v): v is number => v != null);
    const memValues = allRows.map((r) => r.mem).filter((v): v is number => v != null);
    const avgCpu =
      cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : null;
    const avgMemory =
      memValues.length > 0 ? memValues.reduce((a, b) => a + b, 0) / memValues.length : null;

    return { totalClusters, totalNamespaces, totalWorkloads, totalPods, avgCpu, avgMemory };
  }, [clusterRows, namespaceRows, workloadRows, podRows]);

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      <Box sx={{ flex: 1 }}>
        <OverviewInfoCard title="Clusters">
          <Typography variant="h5" component="p">
            {summary.totalClusters}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ flex: 1 }}>
        <OverviewInfoCard title="Namespaces">
          <Typography variant="h5" component="p">
            {summary.totalNamespaces}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ flex: 1 }}>
        <OverviewInfoCard title="Workloads">
          <Typography variant="h5" component="p">
            {summary.totalWorkloads}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ flex: 1 }}>
        <OverviewInfoCard title="Pods">
          <Typography variant="h5" component="p">
            {summary.totalPods}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ flex: 1 }}>
        <OverviewInfoCard title="Avg CPU">
          <Typography variant="h5" component="p">
            {formatCpu(summary.avgCpu)}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ flex: 1 }}>
        <OverviewInfoCard title="Avg Memory">
          <Typography variant="h5" component="p">
            {formatMemory(summary.avgMemory)}
          </Typography>
        </OverviewInfoCard>
      </Box>
    </Stack>
  );
}

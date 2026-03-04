import { useMemo } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { OverviewInfoCard } from "../OverviewInfoCard";

import {
  formatCpu,
  formatMemory,
  type ClusterRow,
  type NamespaceRow,
  type PodRow,
  type WorkloadRow,
} from "./k8sHelpers";

interface K8sOverviewCardsProps {
  clusterRows: ClusterRow[];
  namespaceRows: NamespaceRow[];
  workloadRows: WorkloadRow[];
  podRows: PodRow[];
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

    const cpuValues = podRows.map((r) => r.avgCpu).filter((v): v is number => v != null);
    const memValues = podRows.map((r) => r.avgMemory).filter((v): v is number => v != null);
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

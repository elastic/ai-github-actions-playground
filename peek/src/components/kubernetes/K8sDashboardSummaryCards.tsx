import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { OverviewInfoCard } from "../OverviewInfoCard";

import { formatCpu, formatMemory } from "./k8sHelpers";

export interface K8sDashboardSummary {
  totalPods: number;
  avgCpu: number | null;
  avgMemory: number | null;
  /** Optional extra label/value pairs shown as additional cards. */
  extras?: Array<{ label: string; value: string | number }>;
}

interface K8sDashboardSummaryCardsProps {
  summary: K8sDashboardSummary;
}

export default function K8sDashboardSummaryCards({ summary }: K8sDashboardSummaryCardsProps) {
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      <Box sx={{ flex: 1 }}>
        <OverviewInfoCard title="Pods">
          <Typography variant="h5" component="p">
            {summary.totalPods.toLocaleString()}
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
      {summary.extras?.map((extra) => (
        <Box key={extra.label} sx={{ flex: 1 }}>
          <OverviewInfoCard title={extra.label}>
            <Typography variant="h5" component="p">
              {typeof extra.value === "number" ? extra.value.toLocaleString() : extra.value}
            </Typography>
          </OverviewInfoCard>
        </Box>
      ))}
    </Stack>
  );
}

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { OverviewInfoCard } from "../OverviewInfoCard";

import { formatErrorRate, formatLatency } from "./serviceInventoryHelpers";

export interface ServiceDashboardSummary {
  totalRequests: number;
  totalErrors: number;
  overallErrorRate: number;
  avgLatencyMs: number;
  uniqueRoutes: number;
}

interface ServiceDashboardSummaryCardsProps {
  summary: ServiceDashboardSummary;
}

export default function ServiceDashboardSummaryCards({
  summary,
}: ServiceDashboardSummaryCardsProps) {
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      <Box sx={{ flex: 1 }}>
        <OverviewInfoCard title="Total Requests">
          <Typography variant="h5" component="p">
            {summary.totalRequests.toLocaleString()}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ flex: 1 }}>
        <OverviewInfoCard title="Avg Latency">
          <Typography variant="h5" component="p">
            {formatLatency(summary.avgLatencyMs)}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ flex: 1 }}>
        <OverviewInfoCard title="Error Rate">
          <Typography
            variant="h5"
            component="p"
            sx={{ color: summary.overallErrorRate > 0.05 ? "error.main" : "text.primary" }}
          >
            {formatErrorRate(summary.overallErrorRate)}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ flex: 1 }}>
        <OverviewInfoCard title="Unique Routes">
          <Typography variant="h5" component="p">
            {summary.uniqueRoutes}
          </Typography>
        </OverviewInfoCard>
      </Box>
    </Stack>
  );
}

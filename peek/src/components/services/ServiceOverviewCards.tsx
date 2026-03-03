import { useMemo } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { OverviewInfoCard } from "../OverviewInfoCard";

import { type ServiceRow, formatLatency, formatErrorRate } from "./serviceInventoryHelpers";

interface ServiceOverviewCardsProps {
  serviceRows: ServiceRow[];
}

export default function ServiceOverviewCards({ serviceRows }: ServiceOverviewCardsProps) {
  const summary = useMemo(() => {
    if (serviceRows.length === 0) return null;
    const totals = serviceRows.reduce(
      (acc, row) => {
        acc.requests += row.requestCount;
        acc.errors += row.errorCount;
        return acc;
      },
      { requests: 0, errors: 0 },
    );
    const avgLatencyMs =
      totals.requests > 0
        ? serviceRows.reduce((acc, row) => acc + row.avgLatencyMs * row.requestCount, 0) /
          totals.requests
        : 0;
    return {
      totalServices: serviceRows.length,
      totalRequests: totals.requests,
      totalErrors: totals.errors,
      overallErrorRate: totals.requests > 0 ? totals.errors / totals.requests : 0,
      avgLatencyMs,
    };
  }, [serviceRows]);

  if (!summary) return null;

  return (
    <Stack direction="row" spacing={2}>
      <Box sx={{ flex: 1 }}>
        <OverviewInfoCard title="Total Services">
          <Typography variant="h5" component="p">
            {summary.totalServices}
          </Typography>
        </OverviewInfoCard>
      </Box>
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
    </Stack>
  );
}

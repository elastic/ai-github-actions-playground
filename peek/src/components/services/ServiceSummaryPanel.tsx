import { useMemo } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { type ServiceRow, formatLatency, formatErrorRate } from "./serviceInventoryHelpers";

interface ServiceSummaryPanelProps {
  serviceRows: ServiceRow[];
}

export default function ServiceSummaryPanel({ serviceRows }: ServiceSummaryPanelProps) {
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
      totalRequests: totals.requests,
      totalErrors: totals.errors,
      overallErrorRate: totals.requests > 0 ? totals.errors / totals.requests : 0,
      avgLatencyMs,
      busiestServices: [...serviceRows]
        .sort((a, b) => b.requestCount - a.requestCount)
        .slice(0, 3)
        .map((row) => `${row.serviceName} (${row.requestCount.toLocaleString()})`),
    };
  }, [serviceRows]);

  if (!summary) return null;

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          Total Requests:{" "}
          <Typography
            component="span"
            variant="body2"
            sx={{ color: "text.primary", fontWeight: 600 }}
          >
            {summary.totalRequests.toLocaleString()}
          </Typography>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Avg Service Latency:{" "}
          <Typography
            component="span"
            variant="body2"
            sx={{ color: "text.primary", fontWeight: 600 }}
          >
            {formatLatency(summary.avgLatencyMs)}
          </Typography>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Overall Error Rate:{" "}
          <Typography
            component="span"
            variant="body2"
            sx={{ color: "text.primary", fontWeight: 600 }}
          >
            {formatErrorRate(summary.overallErrorRate)}
          </Typography>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Busiest Services:
        </Typography>
        {summary.busiestServices.map((service) => (
          <Chip key={service} size="small" label={service} variant="outlined" />
        ))}
      </Box>
    </Paper>
  );
}

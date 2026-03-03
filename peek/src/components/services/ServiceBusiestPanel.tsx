import { useMemo } from "react";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { OverviewInfoCard } from "../OverviewInfoCard";

import { type ServiceRow, formatLatency, formatErrorRate } from "./serviceInventoryHelpers";

interface ServiceBusiestPanelProps {
  serviceRows: ServiceRow[];
  onViewTraces: (serviceName: string) => void;
}

export default function ServiceBusiestPanel({
  serviceRows,
  onViewTraces,
}: ServiceBusiestPanelProps) {
  const topServices = useMemo(
    () => [...serviceRows].sort((a, b) => b.requestCount - a.requestCount).slice(0, 5),
    [serviceRows],
  );

  if (topServices.length === 0) return null;

  return (
    <OverviewInfoCard title="Busiest Services">
      <Table size="small" aria-label="Busiest services">
        <TableHead>
          <TableRow>
            <TableCell>Service</TableCell>
            <TableCell align="right">Requests</TableCell>
            <TableCell align="right">Latency</TableCell>
            <TableCell align="right">Error Rate</TableCell>
            <TableCell>Top Error</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {topServices.map((row) => (
            <TableRow key={row.serviceName} hover>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {row.serviceName}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                  <Chip size="small" label={row.language} variant="outlined" />
                  <Chip size="small" label={row.environment} variant="outlined" />
                </Stack>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {row.requestCount.toLocaleString()}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2">{formatLatency(row.avgLatencyMs)}</Typography>
              </TableCell>
              <TableCell align="right">
                <Chip
                  size="small"
                  label={formatErrorRate(row.errorRate)}
                  color={row.errorRate > 0.05 ? "error" : "default"}
                  variant={row.errorRate > 0.05 ? "filled" : "outlined"}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                  {row.topError}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Button
                  size="small"
                  variant="text"
                  aria-label={`View traces for ${row.serviceName}`}
                  onClick={() => onViewTraces(row.serviceName)}
                  sx={{ fontSize: "0.8125rem" }}
                >
                  View Traces →
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </OverviewInfoCard>
  );
}

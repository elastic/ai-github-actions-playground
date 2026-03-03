import { useMemo } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import EmptyState from "../EmptyState";
import { OverviewInfoCard } from "../OverviewInfoCard";

import { type ServiceRow, formatLatency, formatErrorRate } from "./serviceInventoryHelpers";

interface ServicePerformanceChartsProps {
  serviceRows: ServiceRow[];
}

interface RankedService {
  serviceName: string;
  value: number;
  formatted: string;
  ratio: number;
}

interface DistributionEntry {
  label: string;
  count: number;
  ratio: number;
}

function rankByField(
  rows: ServiceRow[],
  field: "avgLatencyMs" | "errorRate",
  formatter: (v: number) => string,
  limit = 5,
): RankedService[] {
  const sorted = [...rows].sort((a, b) => b[field] - a[field]).slice(0, limit);
  const maxVal = sorted.length > 0 ? sorted[0]![field] : 1;
  return sorted.map((row) => ({
    serviceName: row.serviceName,
    value: row[field],
    formatted: formatter(row[field]),
    ratio: maxVal > 0 ? row[field] / maxVal : 0,
  }));
}

function computeDistribution(
  rows: ServiceRow[],
  field: "language" | "environment",
): DistributionEntry[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row[field];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const entries = Array.from(counts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  const total = rows.length;
  return entries.map(([label, count]) => ({
    label,
    count,
    ratio: total > 0 ? count / total : 0,
  }));
}

function RankedList({
  items,
  color = "primary",
}: {
  items: RankedService[];
  color?: "primary" | "error";
}) {
  if (items.length === 0) {
    return <EmptyState heading="No data available" size="small" />;
  }
  return (
    <Table size="small" aria-label="Ranked services">
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.serviceName} sx={{ "&:last-child td": { borderBottom: 0 } }}>
            <TableCell sx={{ width: "40%", pl: 0, py: 1 }}>
              <Typography variant="body2" noWrap>
                {item.serviceName}
              </Typography>
            </TableCell>
            <TableCell sx={{ py: 1 }}>
              <LinearProgress
                variant="determinate"
                value={item.ratio * 100}
                color={color}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </TableCell>
            <TableCell align="right" sx={{ width: "20%", pr: 0, py: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {item.formatted}
              </Typography>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DistributionPanel({ entries }: { entries: DistributionEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState heading="No data available" size="small" />;
  }
  return (
    <Stack spacing={1}>
      {entries.map((entry) => (
        <Box key={entry.label} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography variant="body2" sx={{ minWidth: 80, fontWeight: 500 }} noWrap>
            {entry.label}
          </Typography>
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={entry.ratio * 100}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
          <Chip size="small" label={entry.count} variant="outlined" />
        </Box>
      ))}
    </Stack>
  );
}

export default function ServicePerformanceCharts({ serviceRows }: ServicePerformanceChartsProps) {
  const topByLatency = useMemo(
    () => rankByField(serviceRows, "avgLatencyMs", formatLatency),
    [serviceRows],
  );
  const topByErrorRate = useMemo(
    () => rankByField(serviceRows, "errorRate", formatErrorRate),
    [serviceRows],
  );
  const languageDistribution = useMemo(
    () => computeDistribution(serviceRows, "language"),
    [serviceRows],
  );
  const environmentDistribution = useMemo(
    () => computeDistribution(serviceRows, "environment"),
    [serviceRows],
  );

  if (serviceRows.length === 0) return null;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2}>
        <Box sx={{ flex: 1 }}>
          <OverviewInfoCard title="Slowest Services">
            <RankedList items={topByLatency} />
          </OverviewInfoCard>
        </Box>
        <Box sx={{ flex: 1 }}>
          <OverviewInfoCard title="Highest Error Rate">
            <RankedList items={topByErrorRate} color="error" />
          </OverviewInfoCard>
        </Box>
      </Stack>
      <Stack direction="row" spacing={2}>
        <Box sx={{ flex: 1 }}>
          <OverviewInfoCard title="Services by Language">
            <DistributionPanel entries={languageDistribution} />
          </OverviewInfoCard>
        </Box>
        <Box sx={{ flex: 1 }}>
          <OverviewInfoCard title="Services by Environment">
            <DistributionPanel entries={environmentDistribution} />
          </OverviewInfoCard>
        </Box>
      </Stack>
    </Stack>
  );
}

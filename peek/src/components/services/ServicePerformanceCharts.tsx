import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

import EmptyState from "../EmptyState";
import InsightSlot from "../InsightSlot";
import { useInsightSlotContext } from "../InsightSlotHooks";
import { OverviewInfoCard } from "../OverviewInfoCard";

import {
  SERVICE_INSIGHT_SLOT_IDS,
  highestErrorServiceRowInsightSlotId,
  slowestServiceRowInsightSlotId,
} from "./serviceInsightSlots";
import {
  type ServiceRow,
  type ServiceSparklineData,
  formatLatency,
  formatErrorRate,
} from "./serviceInventoryHelpers";
import ServiceSparklineCell from "./ServiceSparklineCell";

interface ServicePerformanceChartsProps {
  serviceRows: ServiceRow[];
  sparklineData?: Record<string, ServiceSparklineData>;
}

interface RankedService {
  serviceName: string;
  value: number;
  formatted: string;
}

interface DistributionEntry {
  label: string;
  count: number;
  ratio: number;
}

const DEFAULT_RANKED_LIMIT = 5;
const EXPANDED_RANKED_LIMIT = 20;

function rankByField(
  rows: ServiceRow[],
  field: "avgLatencyMs" | "errorRate",
  formatter: (v: number) => string,
  limit = 5,
): RankedService[] {
  return [...rows]
    .sort((a, b) => b[field] - a[field])
    .slice(0, limit)
    .map((row) => ({
      serviceName: row.serviceName,
      value: row[field],
      formatted: formatter(row[field]),
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
  rowSlotIdForService,
  sparklineData,
}: {
  items: RankedService[];
  color?: "primary" | "error";
  rowSlotIdForService?: (serviceName: string) => string;
  sparklineData?: Record<string, ServiceSparklineData>;
}) {
  const theme = useTheme();
  const { insightsBySlot } = useInsightSlotContext();
  if (items.length === 0) {
    return <EmptyState heading="No data available" size="small" />;
  }
  return (
    <Table size="small" aria-label="Ranked services">
      <TableBody>
        {items.map((item) => {
          const rowSlotId = rowSlotIdForService?.(item.serviceName);
          const hasRowInsight = rowSlotId ? insightsBySlot.has(rowSlotId) : false;
          return (
            <TableRow
              key={item.serviceName}
              sx={{
                "&:last-child td": { borderBottom: 0 },
                ...(hasRowInsight
                  ? {
                      "& td": { bgcolor: "action.hover" },
                      "& td:first-of-type": {
                        pl: 1,
                        borderLeft: 3,
                        borderLeftStyle: "solid",
                        borderLeftColor: "primary.main",
                      },
                    }
                  : {}),
              }}
            >
              <TableCell sx={{ width: "40%", py: 1 }}>
                {rowSlotId ? (
                  <InsightSlot slotId={rowSlotId}>
                    <Link
                      component={RouterLink}
                      to={`/services/${encodeURIComponent(item.serviceName)}`}
                      underline="hover"
                      sx={{ display: "inline-block", maxWidth: "100%", fontWeight: 500 }}
                    >
                      <Typography variant="body2" noWrap>
                        {item.serviceName}
                      </Typography>
                    </Link>
                  </InsightSlot>
                ) : (
                  <Link
                    component={RouterLink}
                    to={`/services/${encodeURIComponent(item.serviceName)}`}
                    underline="hover"
                    sx={{ display: "inline-block", maxWidth: "100%", fontWeight: 500 }}
                  >
                    <Typography variant="body2" noWrap>
                      {item.serviceName}
                    </Typography>
                  </Link>
                )}
              </TableCell>
              <TableCell sx={{ py: 1 }}>
                <ServiceSparklineCell
                  data={
                    color === "error"
                      ? (sparklineData?.[item.serviceName]?.errorRate ?? [])
                      : (sparklineData?.[item.serviceName]?.latency ?? [])
                  }
                  color={color === "error" ? theme.palette.error.main : undefined}
                />
              </TableCell>
              <TableCell align="right" sx={{ width: "20%", pr: 0, py: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {item.formatted}
                </Typography>
              </TableCell>
            </TableRow>
          );
        })}
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

export default function ServicePerformanceCharts({
  serviceRows,
  sparklineData,
}: ServicePerformanceChartsProps) {
  const [showMoreSlowest, setShowMoreSlowest] = useState(false);
  const [showMoreHighestError, setShowMoreHighestError] = useState(false);

  const slowestLimit = showMoreSlowest ? EXPANDED_RANKED_LIMIT : DEFAULT_RANKED_LIMIT;
  const highestErrorLimit = showMoreHighestError ? EXPANDED_RANKED_LIMIT : DEFAULT_RANKED_LIMIT;

  const topByLatency = useMemo(
    () => rankByField(serviceRows, "avgLatencyMs", formatLatency, slowestLimit),
    [serviceRows, slowestLimit],
  );
  const topByErrorRate = useMemo(
    () => rankByField(serviceRows, "errorRate", formatErrorRate, highestErrorLimit),
    [serviceRows, highestErrorLimit],
  );
  const languageDistribution = useMemo(
    () => computeDistribution(serviceRows, "language"),
    [serviceRows],
  );
  const environmentDistribution = useMemo(
    () => computeDistribution(serviceRows, "environment"),
    [serviceRows],
  );

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Box sx={{ flex: 1 }}>
          <InsightSlot slotId={SERVICE_INSIGHT_SLOT_IDS.slowestServicesPanel}>
            <OverviewInfoCard title="Slowest Services">
              <Stack spacing={1}>
                <RankedList
                  items={topByLatency}
                  rowSlotIdForService={slowestServiceRowInsightSlotId}
                  sparklineData={sparklineData}
                />
                {serviceRows.length > DEFAULT_RANKED_LIMIT && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setShowMoreSlowest((prev) => !prev)}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    {showMoreSlowest ? "Show less" : "Show more"}
                  </Button>
                )}
              </Stack>
            </OverviewInfoCard>
          </InsightSlot>
        </Box>
        <Box sx={{ flex: 1 }}>
          <InsightSlot slotId={SERVICE_INSIGHT_SLOT_IDS.highestErrorRatePanel}>
            <OverviewInfoCard title="Highest Error Rate">
              <Stack spacing={1}>
                <RankedList
                  items={topByErrorRate}
                  color="error"
                  rowSlotIdForService={highestErrorServiceRowInsightSlotId}
                  sparklineData={sparklineData}
                />
                {serviceRows.length > DEFAULT_RANKED_LIMIT && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setShowMoreHighestError((prev) => !prev)}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    {showMoreHighestError ? "Show less" : "Show more"}
                  </Button>
                )}
              </Stack>
            </OverviewInfoCard>
          </InsightSlot>
        </Box>
      </Stack>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Box sx={{ flex: 1 }}>
          <InsightSlot slotId={SERVICE_INSIGHT_SLOT_IDS.languageDistributionPanel}>
            <OverviewInfoCard title="Services by Language">
              <DistributionPanel entries={languageDistribution} />
            </OverviewInfoCard>
          </InsightSlot>
        </Box>
        <Box sx={{ flex: 1 }}>
          <InsightSlot slotId={SERVICE_INSIGHT_SLOT_IDS.environmentDistributionPanel}>
            <OverviewInfoCard title="Services by Environment">
              <DistributionPanel entries={environmentDistribution} />
            </OverviewInfoCard>
          </InsightSlot>
        </Box>
      </Stack>
    </Stack>
  );
}

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import type { RecentTrace } from "./serviceDashboardHelpers";
import { formatLatency } from "./serviceInventoryHelpers";

function normalizeStatusLabel(statusCode: string): string {
  if (!statusCode || statusCode === "STATUS_CODE_OK") return "OK";
  if (statusCode === "STATUS_CODE_ERROR") return "Error";
  return statusCode;
}

export function ServiceTraceStatusPanel({ traces }: { traces: RecentTrace[] }) {
  const statusBreakdown = useMemo(() => {
    const total = traces.length;
    const counts = new Map<string, number>();
    for (const trace of traces) {
      const label = normalizeStatusLabel(trace.statusCode);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([status, count]) => ({
        status,
        count,
        percent: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [traces]);
  const statusColor = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "ok") return "#4caf50";
    if (normalized.includes("error")) return "#f44336";
    return "#90caf9";
  };

  return (
    <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
      <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Trace Status Breakdown
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1 }}>
        <Box
          sx={{
            display: "flex",
            width: "100%",
            height: 16,
            overflow: "hidden",
            borderRadius: 99,
            bgcolor: "action.hover",
          }}
        >
          {statusBreakdown.map((row) => (
            <Tooltip
              key={row.status}
              title={`${row.status}: ${row.count.toLocaleString()} (${row.percent.toFixed(1)}%)`}
            >
              <Box
                sx={{
                  width: `${Math.max(row.percent, 2)}%`,
                  minWidth: row.percent > 0 ? 2 : 0,
                  bgcolor: statusColor(row.status),
                }}
              />
            </Tooltip>
          ))}
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {statusBreakdown.map((row) => (
            <Chip
              key={row.status}
              size="small"
              variant="outlined"
              label={`${row.status} ${row.percent.toFixed(1)}% (${row.count.toLocaleString()})`}
              sx={{
                "& .MuiChip-label": { fontVariantNumeric: "tabular-nums" },
              }}
            />
          ))}
        </Box>
      </Box>
    </Paper>
  );
}

export function ServiceSlowOperationsPanel({ traces }: { traces: RecentTrace[] }) {
  const slowOperations = useMemo(() => {
    const byOperation = new Map<
      string,
      { count: number; maxDurationMs: number; avgDurationMs: number }
    >();
    for (const trace of traces) {
      const key = trace.spanName || "unknown";
      const current = byOperation.get(key);
      if (!current) {
        byOperation.set(key, {
          count: 1,
          maxDurationMs: trace.durationMs,
          avgDurationMs: trace.durationMs,
        });
      } else {
        const nextCount = current.count + 1;
        byOperation.set(key, {
          count: nextCount,
          maxDurationMs: Math.max(current.maxDurationMs, trace.durationMs),
          avgDurationMs: (current.avgDurationMs * current.count + trace.durationMs) / nextCount,
        });
      }
    }
    return Array.from(byOperation.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.maxDurationMs - a.maxDurationMs)
      .slice(0, 6);
  }, [traces]);

  return (
    <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, overflow: "auto" }}>
      <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Slowest Operations
        </Typography>
      </Box>
      <Table size="small" aria-label="Slowest operations">
        <TableHead>
          <TableRow>
            <TableCell>Operation</TableCell>
            <TableCell align="right">Max</TableCell>
            <TableCell align="right">Avg</TableCell>
            <TableCell align="right">Count</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {slowOperations.map((row) => (
            <TableRow key={row.name}>
              <TableCell>
                <Typography variant="body2" noWrap>
                  {row.name}
                </Typography>
              </TableCell>
              <TableCell align="right">{formatLatency(row.maxDurationMs)}</TableCell>
              <TableCell align="right">{formatLatency(row.avgDurationMs)}</TableCell>
              <TableCell align="right">{row.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

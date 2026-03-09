import { useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import DataFetchAlert from "./DataFetchAlert";

import { useHealthChecks } from "../hooks/useHealthChecks";
import type { EvaluatedHealthCheck, HealthSeverity } from "../health-checks";

import EmptyState from "./EmptyState";
import HealthCheckDrawer from "./HealthCheckDrawer";
import { STATUS_ORDER, SEVERITY_ORDER, statusColor } from "./cluster-health/healthCheckHelpers";

export default function GlobalHealthPage() {
  const { checks, loading, error, refresh, lastUpdatedAt } = useHealthChecks({
    surface: "global",
  });
  const [selectedCheck, setSelectedCheck] = useState<EvaluatedHealthCheck | null>(null);
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdatedAt) return "never";
    const date = new Date(lastUpdatedAt);
    return Number.isNaN(date.getTime()) ? lastUpdatedAt : date.toLocaleString();
  }, [lastUpdatedAt]);

  const orderedChecks = useMemo(
    () =>
      [...checks].sort((a, b) => {
        // Sort by status (fail > warn > unknown > pass)
        const aStatus = STATUS_ORDER[a.status] ?? 4;
        const bStatus = STATUS_ORDER[b.status] ?? 4;
        if (aStatus !== bStatus) return aStatus - bStatus;
        // Then by severity (critical > high > medium > low)
        const aSeverity = a.severity ? SEVERITY_ORDER[a.severity] : Number.MAX_SAFE_INTEGER;
        const bSeverity = b.severity ? SEVERITY_ORDER[b.severity] : Number.MAX_SAFE_INTEGER;
        if (aSeverity !== bSeverity) return aSeverity - bSeverity;
        // Then by domain, then title
        if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
        return a.title.localeCompare(b.title);
      }),
    [checks],
  );

  const failingCounts = useMemo(() => {
    const counts: Record<HealthSeverity | "unknown", number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0,
    };
    for (const check of checks) {
      if (check.status === "unknown") {
        counts.unknown += 1;
        continue;
      }
      if (check.status === "fail" || check.status === "warn") {
        if (check.severity) counts[check.severity] += 1;
        else counts.unknown += 1;
      }
    }
    return counts;
  }, [checks]);

  return (
    <>
      <DataFetchAlert error={error} />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
        <Chip
          size="small"
          color={failingCounts.critical > 0 ? "error" : "default"}
          variant={failingCounts.critical > 0 ? "filled" : "outlined"}
          label={`Critical: ${failingCounts.critical}`}
        />
        <Chip
          size="small"
          color={failingCounts.high > 0 ? "error" : "default"}
          variant={failingCounts.high > 0 ? "filled" : "outlined"}
          label={`High: ${failingCounts.high}`}
        />
        <Chip
          size="small"
          color={failingCounts.medium > 0 ? "warning" : "default"}
          variant={failingCounts.medium > 0 ? "filled" : "outlined"}
          label={`Medium: ${failingCounts.medium}`}
        />
        {failingCounts.low > 0 && (
          <Chip size="small" variant="outlined" label={`Low: ${failingCounts.low}`} />
        )}
        {failingCounts.unknown > 0 && (
          <Chip size="small" variant="outlined" label={`Unknown: ${failingCounts.unknown}`} />
        )}
        <Chip size="small" label={`Last updated: ${formattedLastUpdated}`} variant="outlined" />
        <Button size="small" variant="outlined" onClick={refresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <Table size="small" stickyHeader aria-label="Health check rules">
          <TableHead>
            <TableRow>
              <TableCell>Check</TableCell>
              <TableCell>Domain</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Summary</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="center"
                    py={1}
                  >
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      Running health checks...
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : orderedChecks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    size="small"
                    heading="No health checks available"
                    description="Health checks will appear here once data is loaded."
                  />
                </TableCell>
              </TableRow>
            ) : (
              orderedChecks.map((check) => (
                <TableRow
                  key={check.id}
                  hover
                  onClick={() => setSelectedCheck(check)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>
                    <Button
                      size="small"
                      onClick={() => setSelectedCheck(check)}
                      sx={{
                        p: 0,
                        minWidth: 0,
                        justifyContent: "flex-start",
                        textTransform: "none",
                      }}
                    >
                      {check.title}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {check.domain}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={statusColor(check.status)}
                      label={check.status.toUpperCase()}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {check.severity ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {check.summary}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      <HealthCheckDrawer check={selectedCheck} onClose={() => setSelectedCheck(null)} />
    </>
  );
}

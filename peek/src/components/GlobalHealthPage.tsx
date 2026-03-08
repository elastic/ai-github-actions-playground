import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
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

import { useHealthChecks } from "../hooks/useHealthChecks";
import type { EvaluatedHealthCheck, HealthSeverity, HealthStatus } from "../health-checks";

import EmptyState from "./EmptyState";
import HealthCheckDrawer from "./HealthCheckDrawer";

const SEVERITY_ORDER: Record<HealthSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function statusColor(status: HealthStatus): "success" | "warning" | "error" | "default" {
  if (status === "pass") return "success";
  if (status === "warn") return "warning";
  if (status === "fail") return "error";
  return "default";
}

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
        const aPass = a.status === "pass" ? 1 : 0;
        const bPass = b.status === "pass" ? 1 : 0;
        if (aPass !== bPass) return aPass - bPass;
        if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
        const aSeverity = a.severity ? SEVERITY_ORDER[a.severity] : Number.MAX_SAFE_INTEGER;
        const bSeverity = b.severity ? SEVERITY_ORDER[b.severity] : Number.MAX_SAFE_INTEGER;
        if (aSeverity !== bSeverity) return aSeverity - bSeverity;
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
      if ((check.status === "fail" || check.status === "warn") && check.severity) {
        counts[check.severity] += 1;
      }
    }
    return counts;
  }, [checks]);

  return (
    <>
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
        {failingCounts.critical > 0 && (
          <Chip size="small" color="error" label={`Critical: ${failingCounts.critical}`} />
        )}
        {failingCounts.high > 0 && (
          <Chip
            size="small"
            color="error"
            variant="outlined"
            label={`High: ${failingCounts.high}`}
          />
        )}
        {failingCounts.medium > 0 && (
          <Chip size="small" color="warning" label={`Medium: ${failingCounts.medium}`} />
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
              <TableCell>Summary</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>
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
                <TableCell colSpan={4}>
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

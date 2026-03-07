import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
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
import PageHeader from "./PageHeader";

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
  const navigate = useNavigate();
  const { checks, loading, error, refresh, lastUpdatedAt } = useHealthChecks({ surface: "global" });
  const [selectedCheck, setSelectedCheck] = useState<EvaluatedHealthCheck | null>(null);
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdatedAt) return "never";
    const date = new Date(lastUpdatedAt);
    return Number.isNaN(date.getTime()) ? lastUpdatedAt : date.toLocaleString();
  }, [lastUpdatedAt]);

  const orderedChecks = useMemo(
    () =>
      [...checks].sort((a, b) => {
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Global Health"
          actions={
            <Button size="small" variant="outlined" onClick={refresh} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        />
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Chip color="error" label={`Critical: ${failingCounts.critical}`} />
        <Chip color="error" variant="outlined" label={`High: ${failingCounts.high}`} />
        <Chip color="warning" label={`Medium: ${failingCounts.medium}`} />
        <Chip color="default" label={`Low: ${failingCounts.low}`} />
        <Chip color="default" variant="outlined" label={`Unknown: ${failingCounts.unknown}`} />
        <Chip label={`Last updated: ${formattedLastUpdated}`} variant="outlined" />
      </Stack>

      <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <Table size="small" stickyHeader aria-label="Global health checks">
          <TableHead>
            <TableRow>
              <TableCell>Check</TableCell>
              <TableCell>Domain</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Summary</TableCell>
              <TableCell align="right">Owner link</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="center"
                    py={1}
                  >
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      Loading health checks...
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : orderedChecks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    size="small"
                    heading="No health checks available"
                    description="Health checks will appear here once data is loaded."
                  />
                </TableCell>
              </TableRow>
            ) : (
              orderedChecks.map((check) => (
                <TableRow key={check.id} hover>
                  <TableCell>
                    <Button size="small" onClick={() => setSelectedCheck(check)}>
                      {check.title}
                    </Button>
                  </TableCell>
                  <TableCell>{check.domain}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={statusColor(check.status)}
                      label={check.status.toUpperCase()}
                    />
                  </TableCell>
                  <TableCell>{check.severity ?? "—"}</TableCell>
                  <TableCell>{check.summary}</TableCell>
                  <TableCell align="right">
                    {check.links?.[0] ? (
                      <Button size="small" onClick={() => navigate(check.links![0]!.to)}>
                        {check.links[0]!.label}
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      <Drawer
        anchor="right"
        open={Boolean(selectedCheck)}
        onClose={() => setSelectedCheck(null)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: "100%", sm: 520 },
              p: 2,
              gap: 1,
              display: "flex",
              flexDirection: "column",
            },
          },
        }}
      >
        {selectedCheck && (
          <>
            <Typography variant="h6">{selectedCheck.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedCheck.description}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip size="small" label={selectedCheck.domain} />
              <Chip
                size="small"
                color={statusColor(selectedCheck.status)}
                label={selectedCheck.status.toUpperCase()}
              />
              <Chip size="small" label={selectedCheck.severity ?? "n/a"} variant="outlined" />
            </Stack>
            <Typography variant="body2">{selectedCheck.summary}</Typography>
            {selectedCheck.reason ? <Alert severity="info">{selectedCheck.reason}</Alert> : null}
            {selectedCheck.recommendation ? (
              <Typography variant="body2">
                Recommendation: {selectedCheck.recommendation}
              </Typography>
            ) : null}
            {selectedCheck.observed ? (
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  overflow: "auto",
                  fontSize: 12,
                }}
              >
                {JSON.stringify(selectedCheck.observed, null, 2)}
              </Box>
            ) : null}
            <Stack direction="row" spacing={1}>
              {selectedCheck.links?.map((link, index) => (
                <Button
                  key={`${link.to}-${link.label}-${index}`}
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(link.to)}
                >
                  {link.label}
                </Button>
              ))}
              <Button size="small" onClick={() => setSelectedCheck(null)}>
                Close
              </Button>
            </Stack>
          </>
        )}
      </Drawer>
    </Box>
  );
}

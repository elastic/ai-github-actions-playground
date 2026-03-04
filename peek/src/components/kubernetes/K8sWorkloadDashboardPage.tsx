import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { PAGE_MANIFEST } from "../../routes/manifest";
import { useConnectionStore } from "../../store/useConnectionStore";
import EmptyState from "../EmptyState";
import PageHeader from "../PageHeader";

import K8sDashboardControls from "./K8sDashboardControls";
import K8sDashboardSummaryCards, { type K8sDashboardSummary } from "./K8sDashboardSummaryCards";
import K8sWorkloadTable from "./K8sWorkloadTable";
import { parseWorkloadInventory } from "./k8sHelpers";
import { useK8sDashboardQueries } from "./useK8sDashboardQueries";

export default function K8sWorkloadDashboardPage() {
  const navigate = useNavigate();
  const { kind = "", name = "" } = useParams<{ kind: string; name: string }>();
  const connection = useConnectionStore((s) => s.connection);

  const [timeFrom, setTimeFrom] = useState("NOW() - 1 hour");
  const [timeTo, setTimeTo] = useState("NOW()");

  const {
    clearLatestQueries,
    overviewResult,
    entityResult,
    logsResult,
    tracesResult,
    loading,
    error,
    handleSearch,
    handleReset,
  } = useK8sDashboardQueries({
    connection,
    entity: "workload",
    entityName: name,
    workloadKind: kind,
    timeFrom,
    timeTo,
  });

  const workloadRows = useMemo(
    () => (entityResult ? parseWorkloadInventory(entityResult) : []),
    [entityResult],
  );

  const summary = useMemo<K8sDashboardSummary | null>(() => {
    if (workloadRows.length === 0) return null;
    const totalPods = workloadRows.reduce((sum, r) => sum + r.podCount, 0);
    const cpuValues = workloadRows.filter((r) => r.avgCpu != null).map((r) => r.avgCpu!);
    const memValues = workloadRows.filter((r) => r.avgMemory != null).map((r) => r.avgMemory!);
    return {
      totalPods,
      avgCpu: cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : null,
      avgMemory:
        memValues.length > 0 ? memValues.reduce((a, b) => a + b, 0) / memValues.length : null,
      extras: [{ label: "Kind", value: kind }],
    };
  }, [workloadRows, kind]);

  const hasData = overviewResult || entityResult || logsResult || tracesResult;
  const hasLogs = Boolean(logsResult?.values.length);
  const hasTraces = Boolean(tracesResult?.values.length);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title={`${kind}: ${name}`}
          description="Workload-level dashboard showing pods, resource utilization, logs, and traces."
          actions={
            <Button
              size="small"
              variant="text"
              onClick={() => navigate(PAGE_MANIFEST.kubernetes.path)}
            >
              ← Kubernetes
            </Button>
          }
        />
      </Paper>

      <K8sDashboardControls
        loading={loading}
        timeFrom={timeFrom}
        timeTo={timeTo}
        onSearch={handleSearch}
        onReset={handleReset}
        onTimeRangeChange={(from, to) => {
          clearLatestQueries();
          setTimeFrom(from);
          setTimeTo(to);
        }}
      />

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !hasData && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            heading="No workload data loaded"
            description={`Click Search to load data for ${kind} ${name}.`}
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}

      {summary && <K8sDashboardSummaryCards summary={summary} />}

      {workloadRows.length > 0 && <K8sWorkloadTable rows={workloadRows} />}

      {logsResult && logsResult.values.length > 0 && (
        <Paper variant="outlined" sx={{ overflow: "auto" }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Recent Logs
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {logsResult.values.length} log entries
            </Typography>
          </Box>
        </Paper>
      )}

      {tracesResult && tracesResult.values.length > 0 && (
        <Paper variant="outlined" sx={{ overflow: "auto" }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Recent Traces
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {tracesResult.values.length} traces
            </Typography>
          </Box>
        </Paper>
      )}

      {!loading && hasData && workloadRows.length === 0 && !hasLogs && !hasTraces && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            heading="No data found"
            description={`No data found for ${kind} ${name} in the selected time range.`}
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}
    </Box>
  );
}

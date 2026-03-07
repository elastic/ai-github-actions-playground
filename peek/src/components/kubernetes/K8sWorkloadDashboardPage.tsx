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
import PageHeaderSection from "../PageHeaderSection";

import K8sDashboardControls from "./K8sDashboardControls";
import K8sDashboardSummaryCards, { type K8sDashboardSummary } from "./K8sDashboardSummaryCards";
import K8sServiceLinks from "./K8sServiceLinks";
import K8sWorkloadTable from "./K8sWorkloadTable";
import { parseWorkloadInventory, extractServiceNames } from "./k8sHelpers";
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
    // Pod-count-weighted averages: workloads with more pods contribute proportionally.
    const cpuRows = workloadRows.filter((r) => r.avgCpu != null);
    const cpuPods = cpuRows.reduce((sum, r) => sum + r.podCount, 0);
    const memRows = workloadRows.filter((r) => r.avgMemory != null);
    const memPods = memRows.reduce((sum, r) => sum + r.podCount, 0);
    return {
      totalPods,
      avgCpu:
        cpuPods > 0 ? cpuRows.reduce((sum, r) => sum + r.avgCpu! * r.podCount, 0) / cpuPods : null,
      avgMemory:
        memPods > 0
          ? memRows.reduce((sum, r) => sum + r.avgMemory! * r.podCount, 0) / memPods
          : null,
      extras: [{ label: "Kind", value: kind }],
    };
  }, [workloadRows, kind]);

  const hasData = overviewResult || entityResult || logsResult || tracesResult;
  const hasLogs = Boolean(logsResult?.values.length);
  const hasTraces = Boolean(tracesResult?.values.length);
  const serviceNames = useMemo(
    () => (tracesResult ? extractServiceNames(tracesResult) : []),
    [tracesResult],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: "100%" }}>
      <PageHeaderSection
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

      {!loading && !error && !hasData && (
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

      {serviceNames.length > 0 && <K8sServiceLinks serviceNames={serviceNames} />}

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

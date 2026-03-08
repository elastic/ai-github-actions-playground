import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { PAGE_PATHS } from "../../routes/paths";
import { useConnectionStore } from "../../store/useConnectionStore";
import EmptyState from "../EmptyState";
import PageContainer from "../PageContainer";
import PageHeaderSection from "../PageHeaderSection";

import K8sDashboardControls from "./K8sDashboardControls";
import K8sDashboardSummaryCards, { type K8sDashboardSummary } from "./K8sDashboardSummaryCards";
import K8sPodContainerTable from "./K8sPodContainerTable";
import K8sServiceLinks from "./K8sServiceLinks";
import { parsePodDetail, extractServiceNames } from "./k8sHelpers";
import { useK8sDashboardQueries } from "./useK8sDashboardQueries";

export default function K8sPodDashboardPage() {
  const navigate = useNavigate();
  const { podName = "" } = useParams<{ podName: string }>();
  const connection = useConnectionStore((s) => s.connection);

  const [timeFrom, setTimeFrom] = useState("NOW() - 1 hour");
  const [timeTo, setTimeTo] = useState("NOW()");

  const {
    clearLatestQueries,
    overviewResult,
    logsResult,
    tracesResult,
    loading,
    error,
    handleSearch,
    handleReset,
  } = useK8sDashboardQueries({
    connection,
    entity: "pod",
    entityName: podName,
    timeFrom,
    timeTo,
  });

  const containerRows = useMemo(
    () => (overviewResult ? parsePodDetail(overviewResult) : []),
    [overviewResult],
  );

  const summary = useMemo<K8sDashboardSummary | null>(() => {
    if (containerRows.length === 0) return null;
    const cpuValues = containerRows.filter((r) => r.avgCpu != null).map((r) => r.avgCpu!);
    const memValues = containerRows.filter((r) => r.avgMemory != null).map((r) => r.avgMemory!);
    const totalRestarts = containerRows.reduce((sum, r) => sum + r.restarts, 0);
    return {
      totalPods: 1,
      avgCpu: cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : null,
      avgMemory:
        memValues.length > 0 ? memValues.reduce((a, b) => a + b, 0) / memValues.length : null,
      extras: [
        { label: "Containers", value: containerRows.length },
        { label: "Restarts", value: totalRestarts },
      ],
    };
  }, [containerRows]);

  const hasData = overviewResult || logsResult || tracesResult;
  const hasLogs = Boolean(logsResult?.values.length);
  const hasTraces = Boolean(tracesResult?.values.length);
  const serviceNames = useMemo(
    () => (tracesResult ? extractServiceNames(tracesResult) : []),
    [tracesResult],
  );

  return (
    <PageContainer gap={2}>
      <PageHeaderSection
        title={podName}
        description="Pod-level dashboard showing containers, resource utilization, logs, and traces."
        actions={
          <Button size="small" variant="text" onClick={() => navigate(PAGE_PATHS.kubernetes.path)}>
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

      {!loading && !hasData && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            heading="No pod data loaded"
            description={`Click Search to load data for pod ${podName}.`}
            addDataHref={PAGE_PATHS.addData.path}
          />
        </Paper>
      )}

      {summary && <K8sDashboardSummaryCards summary={summary} />}

      <K8sPodContainerTable rows={containerRows} />

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

      {!loading && hasData && containerRows.length === 0 && !hasLogs && !hasTraces && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            heading="No data found"
            description={`No data found for pod ${podName} in the selected time range.`}
            addDataHref={PAGE_PATHS.addData.path}
          />
        </Paper>
      )}
    </PageContainer>
  );
}

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
import K8sPodTable from "./K8sPodTable";
import { parseNamespaceInventory, parsePodInventory } from "./k8sHelpers";
import { useK8sDashboardQueries } from "./useK8sDashboardQueries";

export default function K8sNamespaceDashboardPage() {
  const navigate = useNavigate();
  const { namespace = "" } = useParams<{ namespace: string }>();
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
    entity: "namespace",
    entityName: namespace,
    timeFrom,
    timeTo,
  });

  const nsRows = useMemo(
    () => (overviewResult ? parseNamespaceInventory(overviewResult) : []),
    [overviewResult],
  );

  const podRows = useMemo(
    () => (entityResult ? parsePodInventory(entityResult) : []),
    [entityResult],
  );

  const summary = useMemo<K8sDashboardSummary | null>(() => {
    const row = nsRows[0];
    if (!row) return null;
    return {
      totalPods: row.podCount,
      avgCpu: row.avgCpu,
      avgMemory: row.avgMemory,
    };
  }, [nsRows]);

  const hasData = overviewResult || entityResult || logsResult || tracesResult;
  const hasLogs = Boolean(logsResult?.values.length);
  const hasTraces = Boolean(tracesResult?.values.length);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: "100%" }}>
      <PageHeaderSection
        title={namespace}
        description="Namespace-level dashboard showing pods, resource utilization, logs, and traces."
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

      {!loading && !hasData && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            heading="No namespace data loaded"
            description={`Click Search to load data for namespace ${namespace}.`}
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}

      {summary && <K8sDashboardSummaryCards summary={summary} />}

      {podRows.length > 0 && <K8sPodTable rows={podRows} />}

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

      {!loading &&
        hasData &&
        podRows.length === 0 &&
        nsRows.length === 0 &&
        !hasLogs &&
        !hasTraces && (
          <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
            <EmptyState
              heading="No data found"
              description={`No data found for namespace ${namespace} in the selected time range.`}
              addDataHref={PAGE_MANIFEST.addData.path}
            />
          </Paper>
        )}
    </Box>
  );
}

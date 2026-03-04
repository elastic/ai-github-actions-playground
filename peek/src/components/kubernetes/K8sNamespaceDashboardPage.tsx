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
import { parseNamespaceInventory, parsePodInventory, formatCpu, formatMemory } from "./k8sHelpers";
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
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
            heading="No namespace data loaded"
            description={`Click Search to load data for namespace ${namespace}.`}
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}

      {summary && <K8sDashboardSummaryCards summary={summary} />}

      {podRows.length > 0 && (
        <Paper variant="outlined" sx={{ overflow: "auto" }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Pods
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {podRows.length} pod{podRows.length !== 1 ? "s" : ""} in this namespace
            </Typography>
          </Box>
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Box component="th" sx={{ p: 1, textAlign: "left" }}>
                  Pod
                </Box>
                <Box component="th" sx={{ p: 1, textAlign: "left" }}>
                  Node
                </Box>
                <Box component="th" sx={{ p: 1, textAlign: "right" }}>
                  Avg CPU
                </Box>
                <Box component="th" sx={{ p: 1, textAlign: "right" }}>
                  Avg Memory
                </Box>
                <Box component="th" sx={{ p: 1, textAlign: "right" }}>
                  Restarts
                </Box>
              </tr>
            </thead>
            <tbody>
              {podRows.map((row) => (
                <tr key={row.podName}>
                  <Box component="td" sx={{ p: 1 }}>
                    {row.podName}
                  </Box>
                  <Box component="td" sx={{ p: 1 }}>
                    {row.nodeName}
                  </Box>
                  <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                    {formatCpu(row.avgCpu)}
                  </Box>
                  <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                    {formatMemory(row.avgMemory)}
                  </Box>
                  <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                    {row.restarts}
                  </Box>
                </tr>
              ))}
            </tbody>
          </Box>
        </Paper>
      )}

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

      {!loading && hasData && podRows.length === 0 && nsRows.length === 0 && (
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

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
import { parseClusterInventory, parseNamespaceInventory } from "./k8sHelpers";
import { useK8sDashboardQueries } from "./useK8sDashboardQueries";

export default function K8sClusterDashboardPage() {
  const navigate = useNavigate();
  const { clusterName = "" } = useParams<{ clusterName: string }>();
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
    entity: "cluster",
    entityName: clusterName,
    timeFrom,
    timeTo,
  });

  const clusterRows = useMemo(
    () => (overviewResult ? parseClusterInventory(overviewResult) : []),
    [overviewResult],
  );

  const namespaceRows = useMemo(
    () => (entityResult ? parseNamespaceInventory(entityResult) : []),
    [entityResult],
  );

  const summary = useMemo<K8sDashboardSummary | null>(() => {
    const row = clusterRows[0];
    if (!row) return null;
    return {
      totalPods: row.podCount,
      avgCpu: row.avgCpu,
      avgMemory: row.avgMemory,
      extras: [
        { label: "Namespaces", value: row.namespaceCount },
        { label: "Nodes", value: row.nodeCount },
      ],
    };
  }, [clusterRows]);

  const hasData = overviewResult || entityResult || logsResult || tracesResult;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title={clusterName}
          description="Cluster-level dashboard showing namespaces, resource utilization, logs, and traces."
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
            heading="No cluster data loaded"
            description={`Click Search to load data for cluster ${clusterName}.`}
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}

      {summary && <K8sDashboardSummaryCards summary={summary} />}

      {namespaceRows.length > 0 && (
        <Paper variant="outlined" sx={{ overflow: "auto" }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Namespaces
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {namespaceRows.length} namespace{namespaceRows.length !== 1 ? "s" : ""} in this
              cluster
            </Typography>
          </Box>
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Box component="th" sx={{ p: 1, textAlign: "left" }}>
                  Namespace
                </Box>
                <Box component="th" sx={{ p: 1, textAlign: "right" }}>
                  Pods
                </Box>
                <Box component="th" sx={{ p: 1, textAlign: "right" }}>
                  Avg CPU
                </Box>
                <Box component="th" sx={{ p: 1, textAlign: "right" }}>
                  Avg Memory
                </Box>
              </tr>
            </thead>
            <tbody>
              {namespaceRows.map((row) => (
                <tr key={row.namespace}>
                  <Box component="td" sx={{ p: 1 }}>
                    {row.namespace}
                  </Box>
                  <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                    {row.podCount}
                  </Box>
                  <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                    {row.avgCpu != null ? `${(row.avgCpu * 100).toFixed(1)}%` : "—"}
                  </Box>
                  <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                    {row.avgMemory != null ? `${(row.avgMemory / 1_048_576).toFixed(1)} MiB` : "—"}
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

      {!loading && hasData && namespaceRows.length === 0 && clusterRows.length === 0 && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            heading="No data found"
            description={`No data found for cluster ${clusterName} in the selected time range.`}
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}
    </Box>
  );
}

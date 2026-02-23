import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import {
  loadFleetServerStatus,
  loadFleetAgentVersions,
  loadFleetOutputHealth,
  loadElasticAgentInventory,
  loadFleetActions,
  loadFleetActionResults,
} from "../services/fleet";
import { useDashboardStore } from "../store/useDashboardStore";
import { useFleetStore, type FleetViewTab } from "../store/useFleetStore";

import FleetStatCard from "./fleet/FleetStatCard";
import FleetStatusChart from "./fleet/FleetStatusChart";
import FleetVersionChart from "./fleet/FleetVersionChart";
import FleetAgentsTable from "./fleet/FleetAgentsTable";
import FleetOutputsList from "./fleet/FleetOutputsList";
import FleetActivityList from "./fleet/FleetActivityList";

const TABS: { value: FleetViewTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "agents", label: "Agents" },
  { value: "outputs", label: "Outputs" },
  { value: "activity", label: "Activity" },
];

const AUTO_REFRESH_MS = 30_000;

export default function FleetPage() {
  const connection = useDashboardStore((s) => s.connection);
  const navigate = useNavigate();

  const activeTab = useFleetStore((s) => s.activeTab);
  const setActiveTab = useFleetStore((s) => s.setActiveTab);
  const loading = useFleetStore((s) => s.loading);
  const error = useFleetStore((s) => s.error);
  const partialErrors = useFleetStore((s) => s.partialErrors);
  const serverStatus = useFleetStore((s) => s.serverStatus);
  const agentVersions = useFleetStore((s) => s.agentVersions);
  const outputHealth = useFleetStore((s) => s.outputHealth);
  const agentInventory = useFleetStore((s) => s.agentInventory);
  const actions = useFleetStore((s) => s.actions);
  const actionResults = useFleetStore((s) => s.actionResults);

  const setServerStatus = useFleetStore((s) => s.setServerStatus);
  const setAgentVersions = useFleetStore((s) => s.setAgentVersions);
  const setOutputHealth = useFleetStore((s) => s.setOutputHealth);
  const setAgentInventory = useFleetStore((s) => s.setAgentInventory);
  const setActions = useFleetStore((s) => s.setActions);
  const setActionResults = useFleetStore((s) => s.setActionResults);
  const setLoading = useFleetStore((s) => s.setLoading);
  const setError = useFleetStore((s) => s.setError);
  const setPartialErrors = useFleetStore((s) => s.setPartialErrors);

  const loadFleetData = useCallback(async () => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    try {
      const client = new ElasticsearchClient(connection);
      const results = await Promise.allSettled([
        loadFleetServerStatus(client),
        loadFleetAgentVersions(client),
        loadFleetOutputHealth(client),
        loadElasticAgentInventory(client),
        loadFleetActions(client),
        loadFleetActionResults(client),
      ]);

      const errors: string[] = [];
      const value = <T,>(r: PromiseSettledResult<T>, label: string): T | null => {
        if (r.status === "fulfilled") return r.value;
        errors.push(`${label}: ${r.reason}`);
        return null;
      };

      setServerStatus(value(results[0]!, "Server status") ?? null);
      setAgentVersions(value(results[1]!, "Agent versions") ?? []);
      setOutputHealth(value(results[2]!, "Output health") ?? []);
      const inventoryResult = value(results[3]!, "Agent inventory");
      setAgentInventory(inventoryResult?.agents ?? []);
      setActions(value(results[4]!, "Actions") ?? []);
      setActionResults(value(results[5]!, "Action results") ?? []);
      setPartialErrors(errors);
    } catch (err) {
      setError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [
    connection,
    setLoading,
    setError,
    setServerStatus,
    setAgentVersions,
    setOutputHealth,
    setAgentInventory,
    setActions,
    setActionResults,
    setPartialErrors,
  ]);

  useEffect(() => {
    void loadFleetData();
  }, [loadFleetData]);

  // Auto-refresh
  const loadRef = useRef(loadFleetData);
  loadRef.current = loadFleetData;
  useEffect(() => {
    const id = setInterval(() => void loadRef.current(), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const handleAgentClick = useCallback(
    (agentId: string) => navigate(`/fleet/agents/${encodeURIComponent(agentId)}`),
    [navigate],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minHeight: 0, height: "100%" }}>
      {/* Header */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" sx={{ flex: 1 }}>
            Fleet
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void loadFleetData()}
            disabled={loading}
          >
            {loading ? <CircularProgress size={16} /> : "Refresh"}
          </Button>
        </Stack>
      </Paper>

      {/* Errors */}
      {error && <Alert severity="error">{error}</Alert>}
      {partialErrors.length > 0 && (
        <Alert severity="warning">Some data sources unavailable: {partialErrors.join("; ")}</Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v: FleetViewTab) => setActiveTab(v)}
        sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.5 } }}
      >
        {TABS.map((t) => (
          <Tab key={t.value} value={t.value} label={t.label} />
        ))}
      </Tabs>

      {/* Initial loading */}
      {loading && !serverStatus && agentInventory.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {activeTab === "overview" && (
            <OverviewTab
              serverStatus={serverStatus}
              agentVersions={agentVersions}
              agentInventory={agentInventory}
            />
          )}
          {activeTab === "agents" && (
            <FleetAgentsTable agents={agentInventory} onAgentClick={handleAgentClick} />
          )}
          {activeTab === "outputs" && <FleetOutputsList outputs={outputHealth} />}
          {activeTab === "activity" && (
            <FleetActivityList actions={actions} actionResults={actionResults} />
          )}
        </Box>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({
  serverStatus,
  agentVersions,
  agentInventory,
}: {
  serverStatus: ReturnType<typeof useFleetStore.getState>["serverStatus"];
  agentVersions: ReturnType<typeof useFleetStore.getState>["agentVersions"];
  agentInventory: ReturnType<typeof useFleetStore.getState>["agentInventory"];
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* Stat cards */}
      {serverStatus ? (
        <>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <FleetStatCard title="Total" value={serverStatus.total} />
            <FleetStatCard title="Healthy" value={serverStatus.healthy} color="success.main" />
            <FleetStatCard title="Unhealthy" value={serverStatus.unhealthy} color="warning.main" />
            <FleetStatCard title="Offline" value={serverStatus.offline} color="text.secondary" />
            <FleetStatCard title="Updating" value={serverStatus.updating} color="info.main" />
            <FleetStatCard title="Inactive" value={serverStatus.inactive} />
          </Stack>

          {/* Unhealthy reason breakdown */}
          {serverStatus.unhealthy > 0 && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Unhealthy reasons:
              </Typography>
              {serverStatus.unhealthyReason.input > 0 && (
                <Chip
                  size="small"
                  label={`Input: ${serverStatus.unhealthyReason.input}`}
                  color="warning"
                  variant="outlined"
                />
              )}
              {serverStatus.unhealthyReason.output > 0 && (
                <Chip
                  size="small"
                  label={`Output: ${serverStatus.unhealthyReason.output}`}
                  color="warning"
                  variant="outlined"
                />
              )}
              {serverStatus.unhealthyReason.other > 0 && (
                <Chip
                  size="small"
                  label={`Other: ${serverStatus.unhealthyReason.other}`}
                  color="warning"
                  variant="outlined"
                />
              )}
            </Stack>
          )}

          {/* Charts */}
          <Box sx={{ display: "flex", gap: 1.5, minHeight: 250 }}>
            <Paper variant="outlined" sx={{ flex: 1, p: 1.5 }}>
              <Typography variant="subtitle2" gutterBottom>
                Agent Status
              </Typography>
              <Box sx={{ height: 200 }}>
                <FleetStatusChart status={serverStatus} />
              </Box>
            </Paper>
            <Paper variant="outlined" sx={{ flex: 1, p: 1.5 }}>
              <Typography variant="subtitle2" gutterBottom>
                Version Distribution
              </Typography>
              <Box sx={{ height: 200 }}>
                <FleetVersionChart versions={agentVersions} />
              </Box>
            </Paper>
          </Box>

          {/* Enrolled/Unenrolled */}
          <Stack direction="row" spacing={1}>
            <Chip size="small" label={`Enrolled: ${serverStatus.enrolled}`} variant="outlined" />
            <Chip
              size="small"
              label={`Unenrolled: ${serverStatus.unenrolled}`}
              variant="outlined"
            />
          </Stack>
        </>
      ) : (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No Fleet Server status metrics found in metrics-fleet_server.agent_status-*.
          </Typography>
          {agentInventory.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              However, {agentInventory.length} agent{agentInventory.length !== 1 ? "s" : ""} found
              via Elastic Agent logs. Switch to the Agents tab to view them.
            </Typography>
          )}
        </Paper>
      )}

      {/* Quick agent summary when no server status but agents exist */}
      {!serverStatus && agentInventory.length > 0 && (
        <>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <FleetStatCard title="Agents (from logs)" value={agentInventory.length} />
            <FleetStatCard
              title="With Errors"
              value={agentInventory.filter((a) => a.errorCount > 0).length}
              color="error.main"
            />
          </Stack>
          {agentVersions.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1.5, height: 200 }}>
              <Typography variant="subtitle2" gutterBottom>
                Version Distribution
              </Typography>
              <Box sx={{ height: 160 }}>
                <FleetVersionChart versions={agentVersions} />
              </Box>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}

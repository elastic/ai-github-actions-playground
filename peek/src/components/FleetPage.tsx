import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import DevicesIcon from "@mui/icons-material/Devices";
import { useShallow } from "zustand/react/shallow";

import { useFleetStore, type FleetViewTab } from "../store/useFleetStore";
import { useFleetData } from "../hooks/useFleetData";

import FleetStatCard from "./fleet/FleetStatCard";
import FleetStatusChart from "./fleet/FleetStatusChart";
import FleetVersionChart from "./fleet/FleetVersionChart";
import FleetAgentsTable from "./fleet/FleetAgentsTable";
import FleetOutputsList from "./fleet/FleetOutputsList";
import FleetActivityList from "./fleet/FleetActivityList";
import RefreshToolbar from "./RefreshToolbar";
import EmptyState from "./EmptyState";
import ContentSkeleton from "./ContentSkeleton";
import PageHeader from "./PageHeader";

const TABS: { value: FleetViewTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "agents", label: "Agents" },
  { value: "outputs", label: "Outputs" },
  { value: "activity", label: "Activity" },
];

const AUTO_REFRESH_MS = 30_000;
const FLEET_REFRESH_OPTIONS = [
  { label: "Off", seconds: 0 },
  { label: "30s", seconds: AUTO_REFRESH_MS / 1000 },
];
type AgentFilterUpdates = Parameters<
  ReturnType<typeof useFleetStore.getState>["updateAgentFilter"]
>[0];

export default function FleetPage() {
  const navigate = useNavigate();

  const {
    activeTab,
    loading,
    error,
    partialErrors,
    serverStatus,
    agentVersions,
    outputHealth,
    agentInventory,
    agentInventoryTotal,
    actions,
    actionResults,
    autoRefreshEnabled,
    lastUpdatedAt,
  } = useFleetStore(
    useShallow((s) => ({
      activeTab: s.activeTab,
      loading: s.loading,
      error: s.error,
      partialErrors: s.partialErrors,
      serverStatus: s.serverStatus,
      agentVersions: s.agentVersions,
      outputHealth: s.outputHealth,
      agentInventory: s.agentInventory,
      agentInventoryTotal: s.agentInventoryTotal,
      actions: s.actions,
      actionResults: s.actionResults,
      autoRefreshEnabled: s.autoRefreshEnabled,
      lastUpdatedAt: s.lastUpdatedAt,
    })),
  );

  const { setActiveTab, setAutoRefreshEnabled, updateAgentFilter, resetFilters } = useFleetStore(
    useShallow((s) => ({
      setActiveTab: s.setActiveTab,
      setAutoRefreshEnabled: s.setAutoRefreshEnabled,
      updateAgentFilter: s.updateAgentFilter,
      resetFilters: s.resetFilters,
    })),
  );

  const { runRefresh } = useFleetData();

  const handleAgentClick = useCallback(
    (agentId: string) => navigate(`/fleet/agents/${encodeURIComponent(agentId)}`),
    [navigate],
  );

  const handleDrillIn = useCallback(
    (updates: AgentFilterUpdates) => {
      resetFilters();
      updateAgentFilter(updates);
      setActiveTab("agents");
    },
    [resetFilters, updateAgentFilter, setActiveTab],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%", minHeight: 0 }}>
      {/* Header */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Fleet"
          actions={
            <RefreshToolbar
              lastUpdatedAt={lastUpdatedAt}
              refreshIntervalSeconds={autoRefreshEnabled ? AUTO_REFRESH_MS / 1000 : 0}
              refreshOptions={FLEET_REFRESH_OPTIONS}
              onIntervalChange={(seconds) => setAutoRefreshEnabled(seconds > 0)}
              onRefresh={() => void runRefresh()}
              loading={loading}
            />
          }
        />
      </Paper>

      {/* Errors */}
      {error && <Alert severity="error">{error}</Alert>}
      {partialErrors.length > 0 && (
        <Alert severity="warning">
          Some data sources are unavailable: {partialErrors.join("; ")}
        </Alert>
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
        <ContentSkeleton variant="cards" />
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {activeTab === "overview" && (
            <OverviewTab
              serverStatus={serverStatus}
              agentVersions={agentVersions}
              agentInventory={agentInventory}
              agentInventoryTotal={agentInventoryTotal}
              onDrillIn={handleDrillIn}
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
  agentInventoryTotal,
  onDrillIn,
}: {
  serverStatus: ReturnType<typeof useFleetStore.getState>["serverStatus"];
  agentVersions: ReturnType<typeof useFleetStore.getState>["agentVersions"];
  agentInventory: ReturnType<typeof useFleetStore.getState>["agentInventory"];
  agentInventoryTotal: ReturnType<typeof useFleetStore.getState>["agentInventoryTotal"];
  onDrillIn: (updates: AgentFilterUpdates) => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* Stat cards */}
      {serverStatus ? (
        <>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <FleetStatCard title="Total" value={serverStatus.total} />
            <FleetStatCard title="Healthy" value={serverStatus.healthy} color="success.main" />
            <FleetStatCard
              title="Unhealthy"
              value={serverStatus.unhealthy}
              color="warning.main"
              onClick={
                serverStatus.unhealthy > 0 ? () => onDrillIn({ hasErrors: true }) : undefined
              }
            />
            <FleetStatCard
              title="Offline"
              value={serverStatus.offline}
              color="text.secondary"
              onClick={
                serverStatus.offline > 0 ? () => onDrillIn({ staleness: "critical" }) : undefined
              }
            />
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
              <Typography variant="body2" gutterBottom>
                Agent Status
              </Typography>
              <Box sx={{ height: 200 }}>
                <FleetStatusChart status={serverStatus} />
              </Box>
            </Paper>
            <Paper variant="outlined" sx={{ flex: 1, p: 1.5 }}>
              <Typography variant="body2" gutterBottom>
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
        <EmptyState
          icon={<DevicesIcon sx={{ fontSize: 32 }} />}
          heading="No Fleet Server status available"
          description={
            agentInventoryTotal > 0
              ? `However, ${agentInventoryTotal} agent${agentInventoryTotal !== 1 ? "s" : ""} found via Elastic Agent logs. Switch to the Agents tab to view them.`
              : "No Fleet Server status metrics found in metrics-fleet_server.agent_status-*."
          }
        />
      )}

      {/* Quick agent summary when no server status but agents exist */}
      {!serverStatus && agentInventoryTotal > 0 && (
        <>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <FleetStatCard title="Agents (from logs)" value={agentInventoryTotal} />
            <FleetStatCard
              title="With Errors"
              value={agentInventory.filter((a) => a.errorCount > 0).length}
              color="error.main"
              onClick={
                agentInventory.some((a) => a.errorCount > 0)
                  ? () => onDrillIn({ hasErrors: true })
                  : undefined
              }
            />
          </Stack>
          {agentVersions.length > 0 && (
            <Paper variant="outlined" sx={{ height: 200, p: 1.5 }}>
              <Typography variant="body2" gutterBottom>
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

import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

import { useFleetStore, type FleetViewTab, type AgentFilter } from "../store/useFleetStore";
import { usePageContextStore } from "../store/usePageContextStore";
import { useFleetData } from "../hooks/useFleetData";

import FleetOverviewTab from "./fleet/FleetOverviewTab";
import FleetAgentsTable from "./fleet/FleetAgentsTable";
import FleetOutputsList from "./fleet/FleetOutputsList";
import FleetActivityList from "./fleet/FleetActivityList";
import RefreshToolbar from "./RefreshToolbar";
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
type AgentFilterUpdates = Partial<AgentFilter>;

export default function FleetPage() {
  const navigate = useNavigate();

  const activeTab = useFleetStore((s) => s.activeTab);
  const autoRefreshEnabled = useFleetStore((s) => s.autoRefreshEnabled);
  const setActiveTab = useFleetStore((s) => s.setActiveTab);
  const setAutoRefreshEnabled = useFleetStore((s) => s.setAutoRefreshEnabled);
  const updateAgentFilter = useFleetStore((s) => s.updateAgentFilter);
  const resetFilters = useFleetStore((s) => s.resetFilters);

  const {
    data: {
      serverStatus,
      agentVersions,
      outputHealth,
      agentInventory,
      agentInventoryTotal,
      agentInventoryTotalErrorCount,
      actions,
      actionResults,
    },
    loading,
    error,
    partialErrors,
    lastUpdatedAt,
    refresh,
  } = useFleetData();

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

  // Publish screen context for AI chat
  const setPageSection = usePageContextStore((s) => s.setPageSection);
  useEffect(() => {
    if (agentInventoryTotal === null) return;
    setPageSection("fleet", {
      totalAgents: agentInventoryTotal ?? 0,
      healthyCount: (agentInventoryTotal ?? 0) - (agentInventoryTotalErrorCount ?? 0),
      unhealthyCount: agentInventoryTotalErrorCount ?? 0,
    });
  }, [agentInventoryTotal, agentInventoryTotalErrorCount, setPageSection]);

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
              onRefresh={refresh}
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
            <FleetOverviewTab
              serverStatus={serverStatus}
              agentVersions={agentVersions}
              agentInventoryTotal={agentInventoryTotal}
              agentInventoryTotalErrorCount={agentInventoryTotalErrorCount}
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

import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

import {
  usePageFiltersStore,
  type FleetViewTab,
  type AgentFilter,
} from "../store/usePageFiltersStore";
import { usePageContextStore } from "../store/usePageContextStore";
import { useFleetData } from "../hooks/useFleetData";
import { COMPONENT_HEIGHTS } from "../types/tokens";

import FleetOverviewTab from "./fleet/FleetOverviewTab";
import FleetAgentsTable from "./fleet/FleetAgentsTable";
import FleetOutputsList from "./fleet/FleetOutputsList";
import FleetActivityList from "./fleet/FleetActivityList";
import PageInsightBanner from "./PageInsightBanner";
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

  const activeTab = usePageFiltersStore((s) => s.fleetActiveTab);
  const autoRefreshEnabled = usePageFiltersStore((s) => s.fleetAutoRefreshEnabled);
  const setActiveTab = usePageFiltersStore((s) => s.setFleetActiveTab);
  const setAutoRefreshEnabled = usePageFiltersStore((s) => s.setFleetAutoRefreshEnabled);
  const updateAgentFilter = usePageFiltersStore((s) => s.updateAgentFilter);
  const resetFilters = usePageFiltersStore((s) => s.resetFleetAgentFilter);

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
    if (agentInventoryTotal == null || agentInventoryTotalErrorCount == null) return;
    setPageSection("fleet", {
      totalAgents: agentInventoryTotal,
      healthyCount: agentInventoryTotal - agentInventoryTotalErrorCount,
      unhealthyCount: agentInventoryTotalErrorCount,
    });
  }, [agentInventoryTotal, agentInventoryTotalErrorCount, setPageSection]);

  useEffect(
    () => () => {
      setPageSection("fleet", undefined);
    },
    [setPageSection],
  );

  const insightContext = useMemo(() => {
    if (agentInventoryTotal == null) return "";
    return JSON.stringify({
      totalAgents: agentInventoryTotal,
      healthyCount: agentInventoryTotal - (agentInventoryTotalErrorCount ?? 0),
      unhealthyCount: agentInventoryTotalErrorCount ?? 0,
      agentVersions,
    });
  }, [agentInventoryTotal, agentInventoryTotalErrorCount, agentVersions]);

  const insightCacheKey = `fleet::${agentInventoryTotal ?? ""}::${agentInventoryTotalErrorCount ?? ""}::${JSON.stringify(agentVersions)}`;

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

      {insightContext && (
        <PageInsightBanner
          context={insightContext}
          systemPrompt="You are a Fleet management advisor for Elastic Agent. Summarize the fleet health in one concise sentence. Mention total agents, how many are healthy vs offline/unhealthy, and note any version inconsistencies that may need attention."
          cacheKey={insightCacheKey}
        />
      )}

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
        sx={{
          minHeight: COMPONENT_HEIGHTS.tab,
          "& .MuiTab-root": { minHeight: COMPONENT_HEIGHTS.tab, py: 0.5 },
        }}
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

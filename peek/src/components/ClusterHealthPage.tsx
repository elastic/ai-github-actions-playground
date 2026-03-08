import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

import { useClusterHealthData } from "../hooks/useClusterHealthData";
import { useHealthChecks } from "../hooks/useHealthChecks";
import { usePageContextStore } from "../store/usePageContextStore";

import CapacityPressureView from "./cluster-health/CapacityPressureView";
import {
  CLUSTER_HEALTH_REFRESH_OPTIONS,
  TABS,
  TAB_SYSTEM_PROMPTS,
  type ClusterHealthView,
} from "./cluster-health/clusterHealthConstants";
import GlobalHealthPage from "./GlobalHealthPage";
import OverviewView from "./cluster-health/OverviewView";
import PageInsightBanner from "./PageInsightBanner";
import RefreshToolbar from "./RefreshToolbar";
import ResilienceSignalsView from "./cluster-health/ResilienceSignalsView";
import ShardDistributionView from "./cluster-health/ShardDistributionView";
import TaskBacklogView from "./cluster-health/TaskBacklogView";
import PageContainer from "./PageContainer";
import PageHeaderSection from "./PageHeaderSection";
import DocLink from "./DocLink";

interface ClusterHealthPageProps {
  defaultTab?: ClusterHealthView;
}

export default function ClusterHealthPage({ defaultTab = "rules" }: ClusterHealthPageProps) {
  const [activeTab, setActiveTab] = useState<ClusterHealthView>(defaultTab);
  const [partialDismissed, setPartialDismissed] = useState(false);
  const {
    data,
    loading,
    error,
    partialErrors,
    lastUpdatedAt,
    refresh: rawRefresh,
    refreshIntervalMs,
    setRefreshIntervalMs,
  } = useClusterHealthData();

  const {
    checks: localChecks,
    loading: localChecksLoading,
    error: localChecksError,
    refresh: refreshLocalChecks,
  } = useHealthChecks({
    surface: "local",
    checkIds: ["cluster.pending_tasks.nonzero", "ilm.indices.error.present"],
  });
  const refresh = useCallback(() => {
    setPartialDismissed(false);
    rawRefresh();
    refreshLocalChecks();
  }, [rawRefresh, refreshLocalChecks]);
  const localFindings = localChecks.filter((check) => check.status !== "pass");

  // Publish screen context for AI chat
  const setPageSection = usePageContextStore((s) => s.setPageSection);
  useEffect(() => {
    if (!data) {
      setPageSection("clusterHealth", undefined);
      return;
    }
    setPageSection("clusterHealth", {
      status: data.clusterHealth?.status ?? "unknown",
      unassignedShards: data.clusterHealth?.unassigned_shards ?? 0,
      pendingTasks: data.pendingTasks?.tasks?.length ?? 0,
      activeTab,
    });
  }, [data, activeTab, setPageSection]);

  useEffect(
    () => () => {
      setPageSection("clusterHealth", undefined);
    },
    [setPageSection],
  );

  const insightContext = useMemo(() => {
    if (!data) return "";
    return JSON.stringify({
      activeTab,
      status: data.clusterHealth?.status ?? "unknown",
      unassignedShards: data.clusterHealth?.unassigned_shards ?? 0,
      pendingTasks: data.pendingTasks?.tasks?.length ?? 0,
      nodeCount: data.clusterHealth?.number_of_nodes ?? 0,
    });
  }, [data, activeTab]);

  const insightCacheKey = `cluster-health::${activeTab}::${data?.clusterHealth?.status ?? ""}::${data?.clusterHealth?.unassigned_shards ?? 0}::${data?.pendingTasks?.tasks?.length ?? 0}::${data?.clusterHealth?.number_of_nodes ?? 0}`;

  return (
    <PageContainer gap={1.5}>
      <PageHeaderSection
        title="Health"
        titleAdornment={<DocLink section="cluster-health" tooltip="Cluster Health docs" />}
        actions={
          <RefreshToolbar
            lastUpdatedAt={lastUpdatedAt}
            refreshIntervalSeconds={refreshIntervalMs / 1000}
            refreshOptions={CLUSTER_HEALTH_REFRESH_OPTIONS}
            onIntervalChange={(s) => setRefreshIntervalMs(s * 1000)}
            onRefresh={refresh}
            loading={loading}
          />
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {!error && partialErrors.length > 0 && !partialDismissed ? (
        <Alert severity="warning" onClose={() => setPartialDismissed(true)}>
          Partial data loaded. Unavailable: {partialErrors.join(", ")}.
        </Alert>
      ) : null}
      {activeTab !== "rules" && localChecksError ? (
        <Alert severity="error">Snapshot checks unavailable: {localChecksError}</Alert>
      ) : null}
      {activeTab !== "rules" && !localChecksError && localChecksLoading ? (
        <Alert severity="info">Health checks running...</Alert>
      ) : null}
      {activeTab !== "rules" &&
      !localChecksError &&
      !localChecksLoading &&
      localFindings.length > 0 ? (
        <Alert severity="warning">
          Snapshot checks: {localFindings.length} alert{localFindings.length === 1 ? "" : "s"} —{" "}
          {localFindings[0]?.summary}
        </Alert>
      ) : null}

      <Tabs
        value={activeTab}
        onChange={(_, v: ClusterHealthView) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
      >
        {TABS.map((t) => (
          <Tab key={t.value} value={t.value} label={t.label} />
        ))}
      </Tabs>

      {insightContext && activeTab !== "rules" && (
        <PageInsightBanner
          context={insightContext}
          systemPrompt={TAB_SYSTEM_PROMPTS[activeTab]}
          cacheKey={insightCacheKey}
        />
      )}

      {activeTab === "rules" ? (
        <GlobalHealthPage />
      ) : (
        <Paper role="tabpanel" variant="outlined" sx={{ flex: 1, overflow: "auto", p: 2 }}>
          {activeTab === "overview" && <OverviewView data={data} />}
          {activeTab === "taskBacklog" && <TaskBacklogView data={data} />}
          {activeTab === "capacityPressure" && <CapacityPressureView data={data} />}
          {activeTab === "shardDistribution" && <ShardDistributionView data={data} />}
          {activeTab === "resilienceSignals" && <ResilienceSignalsView data={data} />}
        </Paper>
      )}
    </PageContainer>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

import { useClusterHealthData } from "../hooks/useClusterHealthData";
import { usePageContextStore } from "../store/usePageContextStore";

import CapacityPressureView from "./cluster-health/CapacityPressureView";
import NodeDetailTable from "./cluster-health/NodeDetailTable";
import OverviewView from "./cluster-health/OverviewView";
import PageInsightBanner from "./PageInsightBanner";
import type { RefreshIntervalOption } from "./RefreshIntervalPicker";
import RefreshToolbar from "./RefreshToolbar";
import ResilienceSignalsView from "./cluster-health/ResilienceSignalsView";
import ShardDistributionView from "./cluster-health/ShardDistributionView";
import TaskBacklogView from "./cluster-health/TaskBacklogView";
import PageHeader from "./PageHeader";

export type ClusterHealthView =
  | "overview"
  | "nodes"
  | "taskBacklog"
  | "capacityPressure"
  | "shardDistribution"
  | "resilienceSignals";

const CLUSTER_HEALTH_REFRESH_OPTIONS: RefreshIntervalOption[] = [
  { label: "Off", seconds: 0 },
  { label: "10s", seconds: 10 },
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
];

const TABS: { value: ClusterHealthView; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "nodes", label: "Nodes" },
  { value: "taskBacklog", label: "Tasks" },
  { value: "capacityPressure", label: "Capacity" },
  { value: "shardDistribution", label: "Shards" },
  { value: "resilienceSignals", label: "Resilience" },
];

interface ClusterHealthPageProps {
  defaultTab?: ClusterHealthView;
}

export default function ClusterHealthPage({ defaultTab = "overview" }: ClusterHealthPageProps) {
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

  const refresh = useCallback(() => {
    setPartialDismissed(false);
    rawRefresh();
  }, [rawRefresh]);

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

  const TAB_SYSTEM_PROMPTS: Record<ClusterHealthView, string> = useMemo(
    () => ({
      overview:
        "You are an Elasticsearch cluster health advisor. Summarize the cluster health overview in one concise sentence. Mention health status, node count, and any unassigned shards or pending tasks. If needed data is unavailable in context, explicitly say it is unavailable.",
      nodes:
        "You are an Elasticsearch node analyst. Summarize node distribution and health. Flag unusual node roles only when present in context. If needed data is unavailable in context, explicitly say it is unavailable.",
      taskBacklog:
        "You are an Elasticsearch task analyst. Summarize pending tasks and any backlog concerns. If needed data is unavailable in context, explicitly say it is unavailable.",
      capacityPressure:
        "You are an Elasticsearch capacity analyst. Summarize capacity pressure indicators from the provided context only. If needed data is unavailable in context, explicitly say it is unavailable.",
      shardDistribution:
        "You are an Elasticsearch shard analyst. Summarize shard-distribution concerns from the provided context only. If needed data is unavailable in context, explicitly say it is unavailable.",
      resilienceSignals:
        "You are an Elasticsearch resilience advisor. Summarize cluster resilience signals from the provided context only. If needed data is unavailable in context, explicitly say it is unavailable.",
    }),
    [],
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Cluster Health"
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
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {!error && partialErrors.length > 0 && !partialDismissed ? (
        <Alert severity="warning" onClose={() => setPartialDismissed(true)}>
          Partial data loaded. Unavailable: {partialErrors.join(", ")}.
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

      {insightContext && (
        <PageInsightBanner
          context={insightContext}
          systemPrompt={TAB_SYSTEM_PROMPTS[activeTab]}
          cacheKey={insightCacheKey}
        />
      )}

      <Paper role="tabpanel" variant="outlined" sx={{ flex: 1, overflow: "auto", p: 2 }}>
        {activeTab === "overview" && <OverviewView data={data} />}
        {activeTab === "nodes" && <NodeDetailTable data={data} />}
        {activeTab === "taskBacklog" && <TaskBacklogView data={data} />}
        {activeTab === "capacityPressure" && <CapacityPressureView data={data} />}
        {activeTab === "shardDistribution" && <ShardDistributionView data={data} />}
        {activeTab === "resilienceSignals" && <ResilienceSignalsView data={data} />}
      </Paper>
    </Box>
  );
}

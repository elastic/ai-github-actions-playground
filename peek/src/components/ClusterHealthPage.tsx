import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";

import { useClusterHealthData } from "../hooks/useClusterHealthData";

import CapacityPressureView from "./cluster-health/CapacityPressureView";
import NodeDetailTable from "./cluster-health/NodeDetailTable";
import OverviewView from "./cluster-health/OverviewView";
import RefreshPicker from "./cluster-health/RefreshPicker";
import ResilienceSignalsView from "./cluster-health/ResilienceSignalsView";
import ShardDistributionView from "./cluster-health/ShardDistributionView";
import TaskBacklogView from "./cluster-health/TaskBacklogView";

export type ClusterHealthView =
  | "overview"
  | "nodes"
  | "taskBacklog"
  | "capacityPressure"
  | "shardDistribution"
  | "resilienceSignals";

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
  const {
    data,
    loading,
    error,
    partialErrors,
    lastUpdatedAt,
    refresh,
    refreshIntervalMs,
    setRefreshIntervalMs,
  } = useClusterHealthData();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minHeight: 0, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" component="h1" sx={{ flex: 1 }}>
            Cluster Health
          </Typography>
          <RefreshPicker
            intervalMs={refreshIntervalMs}
            onIntervalChange={setRefreshIntervalMs}
            onRefresh={refresh}
            loading={loading}
            lastUpdatedAt={lastUpdatedAt}
          />
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {!error && partialErrors.length > 0 ? (
        <Alert severity="warning">
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

      <Paper variant="outlined" sx={{ p: 2, flex: 1, overflow: "auto" }}>
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

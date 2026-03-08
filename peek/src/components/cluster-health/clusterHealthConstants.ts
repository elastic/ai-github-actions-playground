import { INSIGHT_GUARDRAIL } from "../../hooks/insightPromptUtils";
import type { RefreshIntervalOption } from "../RefreshIntervalPicker";

export type ClusterHealthView =
  | "rules"
  | "overview"
  | "nodes"
  | "taskBacklog"
  | "capacityPressure"
  | "shardDistribution"
  | "resilienceSignals";

export const CLUSTER_HEALTH_REFRESH_OPTIONS: RefreshIntervalOption[] = [
  { label: "Off", seconds: 0 },
  { label: "10s", seconds: 10 },
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
];

export const TABS: { value: ClusterHealthView; label: string }[] = [
  { value: "rules", label: "Rules" },
  { value: "overview", label: "Overview" },
  { value: "nodes", label: "Nodes" },
  { value: "taskBacklog", label: "Tasks" },
  { value: "capacityPressure", label: "Capacity" },
  { value: "shardDistribution", label: "Shards" },
  { value: "resilienceSignals", label: "Resilience" },
];

export const TAB_SYSTEM_PROMPTS: Record<ClusterHealthView, string> = {
  rules:
    "You are an Elasticsearch health advisor. Summarize the health check results: how many rules passed, failed, or warned. Highlight any critical or high-severity findings." +
    INSIGHT_GUARDRAIL,
  overview:
    "You are an Elasticsearch cluster health advisor. Summarize the cluster health overview in one concise sentence. Mention health status, node count, and any unassigned shards or pending tasks." +
    INSIGHT_GUARDRAIL,
  nodes:
    "You are an Elasticsearch node analyst. Summarize node distribution and health. Flag unusual node roles only when present in context." +
    INSIGHT_GUARDRAIL,
  taskBacklog:
    "You are an Elasticsearch task analyst. Summarize pending tasks and any backlog concerns." +
    INSIGHT_GUARDRAIL,
  capacityPressure:
    "You are an Elasticsearch capacity analyst. Summarize capacity pressure indicators from the provided context only." +
    INSIGHT_GUARDRAIL,
  shardDistribution:
    "You are an Elasticsearch shard analyst. Summarize shard-distribution concerns from the provided context only." +
    INSIGHT_GUARDRAIL,
  resilienceSignals:
    "You are an Elasticsearch resilience advisor. Summarize cluster resilience signals from the provided context only." +
    INSIGHT_GUARDRAIL,
};

import { useMemo } from "react";

import { INSIGHT_GUARDRAIL } from "../../hooks/insightPromptUtils";
import PageInsightBanner from "../PageInsightBanner";

import type { ClusterRow, NamespaceRow, PodRow, WorkloadRow } from "./k8sHelpers";

const MAX_CONTEXT_ROWS = 50;

interface K8sInsightsPanelProps {
  clusterRows: ClusterRow[];
  namespaceRows: NamespaceRow[];
  workloadRows: WorkloadRow[];
  podRows: PodRow[];
}

export default function K8sInsightsPanel({
  clusterRows,
  namespaceRows,
  workloadRows,
  podRows,
}: K8sInsightsPanelProps) {
  const totalRows =
    clusterRows.length + namespaceRows.length + workloadRows.length + podRows.length;

  const insightContext = useMemo(() => {
    if (totalRows === 0) return "";
    return JSON.stringify({
      clusters: clusterRows.slice(0, MAX_CONTEXT_ROWS).map((r) => ({
        name: r.clusterName,
        podCount: r.podCount,
        avgCpu: r.avgCpu,
        avgMemory: r.avgMemory,
        namespaceCount: r.namespaceCount,
        nodeCount: r.nodeCount,
      })),
      namespaces: namespaceRows.slice(0, MAX_CONTEXT_ROWS).map((r) => ({
        name: r.namespace,
        podCount: r.podCount,
        avgCpu: r.avgCpu,
        avgMemory: r.avgMemory,
      })),
      workloads: workloadRows.slice(0, MAX_CONTEXT_ROWS).map((r) => ({
        name: r.workloadName,
        podCount: r.podCount,
        avgCpu: r.avgCpu,
        avgMemory: r.avgMemory,
      })),
      pods: podRows.slice(0, MAX_CONTEXT_ROWS).map((r) => ({
        name: r.podName,
        namespace: r.namespace,
        nodeName: r.nodeName,
        avgCpu: r.avgCpu,
        avgMemory: r.avgMemory,
        restarts: r.restarts,
      })),
    });
  }, [clusterRows, namespaceRows, workloadRows, podRows, totalRows]);

  if (totalRows === 0) return null;

  return (
    <PageInsightBanner
      context={insightContext}
      systemPrompt={`You are a Kubernetes observability advisor analyzing cluster, namespace, workload, and pod metrics. Provide 2-3 concise, actionable insights about resource utilisation, pod restarts, or cluster health concerns. Focus on what an SRE should investigate first. Keep it brief.${INSIGHT_GUARDRAIL}`}
      cacheKey={insightContext}
    />
  );
}

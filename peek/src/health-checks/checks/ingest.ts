import type { NodeStatsNode } from "../../services/es";

import type { HealthCheckDefinition, HealthSnapshot } from "../types";

const INGEST_ERROR_RATE_HIGH = 0.05;
const INGEST_TIME_PER_DOC_HIGH_MS = 50;
const INGEST_CURRENT_INFLIGHT_HIGH = 100;
const INGEST_SKEW_RATIO = 3.0;

function getNodes(snapshot: HealthSnapshot): NodeStatsNode[] {
  return Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export const ingestChecks: HealthCheckDefinition[] = [
  // #105
  {
    id: "ingest.pipelines.error_rate.high",
    domain: "ingest",
    title: "Ingest pipeline error rate high",
    description: `Warns when any pipeline error rate > ${(INGEST_ERROR_RATE_HIGH * 100).toFixed(0)}%.`,
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "High error rates indicate systematic pipeline failures. Review processor configs and input data.",
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      const pipelineStats = new Map<string, { count: number; failed: number }>();
      for (const node of nodes) {
        for (const [name, stats] of Object.entries(node.ingest?.pipelines ?? {})) {
          const existing = pipelineStats.get(name) ?? { count: 0, failed: 0 };
          existing.count += stats.count ?? 0;
          existing.failed += stats.failed ?? 0;
          pipelineStats.set(name, existing);
        }
      }
      const highError = [...pipelineStats.entries()]
        .filter(([, s]) => s.count > 0 && s.failed / s.count > INGEST_ERROR_RATE_HIGH)
        .map(([name, s]) => ({ name, errorRate: s.failed / s.count }));
      if (highError.length > 0) {
        return {
          status: "warn",
          summary: `${highError.length} pipeline${highError.length === 1 ? "" : "s"} with high error rate.`,
          observed: { pipelines: highError.slice(0, 10) },
          recommendation: "High error rates indicate systematic pipeline processing failures.",
          links: [{ label: "Ingest Pipelines", to: "/ingest-pipelines" }],
        };
      }
      return { status: "pass", summary: "Ingest pipeline error rates within threshold." };
    },
  },
  // #106
  {
    id: "ingest.pipelines.time_per_doc.high",
    domain: "ingest",
    title: "Ingest time per document high",
    description: `Warns when any pipeline processing time > ${INGEST_TIME_PER_DOC_HIGH_MS}ms per document.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "Slow pipelines bottleneck indexing. Optimize processors or remove unnecessary enrichment steps.",
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      const pipelineStats = new Map<string, { count: number; timeMs: number }>();
      for (const node of nodes) {
        for (const [name, stats] of Object.entries(node.ingest?.pipelines ?? {})) {
          const existing = pipelineStats.get(name) ?? { count: 0, timeMs: 0 };
          existing.count += stats.count ?? 0;
          existing.timeMs += stats.time_in_millis ?? 0;
          pipelineStats.set(name, existing);
        }
      }
      const slow = [...pipelineStats.entries()]
        .filter(([, s]) => s.count > 0 && s.timeMs / s.count > INGEST_TIME_PER_DOC_HIGH_MS)
        .map(([name, s]) => ({ name, msPerDoc: s.timeMs / s.count }));
      if (slow.length > 0) {
        return {
          status: "warn",
          summary: `${slow.length} pipeline${slow.length === 1 ? "" : "s"} with high per-document processing time.`,
          observed: { pipelines: slow.slice(0, 10) },
          recommendation:
            "Optimize pipeline processors; consider removing unnecessary enrichment steps.",
          links: [{ label: "Ingest Pipelines", to: "/ingest-pipelines" }],
        };
      }
      return { status: "pass", summary: "Ingest per-document times within threshold." };
    },
  },
  // #107
  {
    id: "ingest.pipelines.current_inflight.high",
    domain: "ingest",
    title: "Ingest current in-flight high",
    description: `Warns when total current in-flight ingest operations > ${INGEST_CURRENT_INFLIGHT_HIGH}.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "High in-flight ingest count may indicate slow pipelines or excessive indexing volume.",
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      let totalCurrent = 0;
      for (const node of nodes) {
        totalCurrent += node.ingest?.total?.current ?? 0;
      }
      if (totalCurrent > INGEST_CURRENT_INFLIGHT_HIGH) {
        return {
          status: "warn",
          summary: `${totalCurrent} in-flight ingest operations cluster-wide.`,
          observed: { totalCurrent },
          recommendation:
            "High in-flight count may indicate slow pipelines or high indexing volume.",
        };
      }
      return { status: "pass", summary: `In-flight ingest (${totalCurrent}) within threshold.` };
    },
  },
  // #109
  {
    id: "ingest.nodes.skew",
    domain: "ingest",
    title: "Ingest node skew",
    description: "Warns when ingest document counts are heavily skewed toward one node.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "Ingest load is unevenly distributed. Consider load-balancing ingest traffic across nodes.",
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      if (nodes.length < 2)
        return { status: "pass", summary: "Single node; skew check not applicable." };
      const counts = nodes.map((n) => ({
        name: n.name ?? "unknown",
        count: n.ingest?.total?.count ?? 0,
      }));
      const totalCount = counts.reduce((s, c) => s + c.count, 0);
      if (totalCount === 0) return { status: "pass", summary: "No ingest activity." };
      const medianCount = median(counts.map((c) => c.count));
      const maxNode = counts.reduce((max, c) => (c.count > max.count ? c : max), counts[0]!);
      if (medianCount > 0 && maxNode.count / medianCount >= INGEST_SKEW_RATIO) {
        return {
          status: "warn",
          summary: `Ingest skew: ${maxNode.name} processed ${maxNode.count} docs vs median ${medianCount.toFixed(0)}.`,
          observed: { maxNode: maxNode.name, maxCount: maxNode.count, median: medianCount },
          recommendation: "Consider load-balancing ingest traffic across nodes.",
        };
      }
      return { status: "pass", summary: "Ingest load distributed evenly across nodes." };
    },
  },
];

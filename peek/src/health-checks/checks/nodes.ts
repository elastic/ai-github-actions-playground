import {
  totalCircuitBreakerTrips,
  totalThreadPoolRejections,
} from "../../components/cluster-health/clusterHealthUtils";

import type { HealthCheckDefinition } from "../types";

const FS_AVAILABLE_LOW_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
const THREAD_POOL_QUEUE_THRESHOLD = 200;
const HEAP_PERCENT_HIGH_THRESHOLD = 85;
const CPU_PERCENT_HIGH_THRESHOLD = 90;

function unknownNodeStatsResult() {
  return {
    status: "unknown" as const,
    summary: "Node stats unavailable.",
    recommendation: "Ensure node stats are collected and verify cluster monitor permissions.",
  };
}

export const nodeChecks: HealthCheckDefinition[] = [
  // #31
  {
    id: "nodes.jvm.heap_percent.high",
    domain: "nodes",
    title: "Node heap utilization",
    description: "Warns when any node JVM heap usage is >= 85%.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodeStats = snapshot.data.nodesCore?.nodeStats?.nodes;
      if (!nodeStats) return unknownNodeStatsResult();
      const nodes = Object.values(nodeStats);
      const hottestNode = nodes
        .map((node) => ({
          name: node.name ?? "unknown",
          heap: node.jvm?.mem?.heap_used_percent ?? 0,
        }))
        .sort((a, b) => b.heap - a.heap)[0];

      if ((hottestNode?.heap ?? 0) >= HEAP_PERCENT_HIGH_THRESHOLD) {
        return {
          status: "warn",
          summary: `High JVM heap on ${hottestNode?.name} (${hottestNode?.heap}%).`,
          observed: { node: hottestNode?.name, heap_used_percent: hottestNode?.heap },
          recommendation: "Consider increasing heap size or reducing memory-intensive operations.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }

      return { status: "pass", summary: "Node JVM heap utilization is within threshold." };
    },
  },
  // #34
  {
    id: "nodes.cpu.percent.high",
    domain: "nodes",
    title: "Node CPU utilization",
    description: "Warns when any node CPU usage is >= 90%.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodeStats = snapshot.data.nodesCore?.nodeStats?.nodes;
      if (!nodeStats) return unknownNodeStatsResult();
      const nodes = Object.values(nodeStats);
      const hottestNode = nodes
        .map((node) => ({ name: node.name ?? "unknown", cpu: node.os?.cpu?.percent ?? 0 }))
        .sort((a, b) => b.cpu - a.cpu)[0];

      if ((hottestNode?.cpu ?? 0) >= CPU_PERCENT_HIGH_THRESHOLD) {
        return {
          status: "warn",
          summary: `High CPU on ${hottestNode?.name} (${hottestNode?.cpu}%).`,
          observed: { node: hottestNode?.name, cpu_percent: hottestNode?.cpu },
          recommendation: "Investigate heavy queries or indexing load on the node.",
          links: [{ label: "Nodes", to: "/nodes" }],
        };
      }

      return { status: "pass", summary: "Node CPU utilization is within threshold." };
    },
  },
  // #37
  {
    id: "nodes.fs.available.low",
    domain: "nodes",
    title: "Node filesystem available low",
    description: "Warns when any node available disk space is below threshold.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodeStats = snapshot.data.nodesCore?.nodeStats?.nodes;
      if (!nodeStats) return unknownNodeStatsResult();
      const nodes = Object.values(nodeStats);
      const lowestNode = nodes
        .map((node) => ({
          name: node.name ?? "unknown",
          available: node.fs?.total?.available_in_bytes ?? Number.MAX_SAFE_INTEGER,
          total: node.fs?.total?.total_in_bytes ?? 0,
        }))
        .sort((a, b) => a.available - b.available)[0];

      if (lowestNode && lowestNode.available < FS_AVAILABLE_LOW_BYTES) {
        const availableGb = (lowestNode.available / (1024 * 1024 * 1024)).toFixed(1);
        return {
          status: "warn",
          summary: `Low disk space on ${lowestNode.name} (${availableGb} GB available).`,
          observed: {
            node: lowestNode.name,
            available_bytes: lowestNode.available,
            total_bytes: lowestNode.total,
          },
          recommendation: "Free disk space or add storage capacity to prevent watermark breaches.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }

      return { status: "pass", summary: "Node disk space is within threshold." };
    },
  },
  // #45
  {
    id: "nodes.thread_pool.search.queue.high",
    domain: "nodes",
    title: "Search thread pool queue high",
    description: "Warns when search thread pool queue exceeds threshold on any node.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodeStats = snapshot.data.nodesCore?.nodeStats?.nodes;
      if (!nodeStats) return unknownNodeStatsResult();
      const nodes = Object.entries(nodeStats);
      for (const [, node] of nodes) {
        const queue = node.thread_pool?.search?.queue ?? 0;
        if (queue >= THREAD_POOL_QUEUE_THRESHOLD) {
          return {
            status: "warn",
            summary: `Search queue at ${queue} on ${node.name ?? "unknown"}.`,
            observed: {
              node: node.name,
              search_queue: queue,
              threshold: THREAD_POOL_QUEUE_THRESHOLD,
            },
            recommendation: "Reduce search concurrency or scale search capacity.",
            links: [{ label: "Cluster Health", to: "/cluster-health" }],
          };
        }
      }
      return { status: "pass", summary: "Search thread pool queues are within threshold." };
    },
  },
  // #46
  {
    id: "nodes.thread_pool.search.rejected.nonzero",
    domain: "nodes",
    title: "Search thread pool rejections",
    description: "Warns when search thread pool rejections are non-zero.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = snapshot.data.nodesCore?.nodeStats?.nodes;
      if (!nodes) return unknownNodeStatsResult();
      let totalRejected = 0;
      for (const node of Object.values(nodes)) {
        totalRejected += node.thread_pool?.search?.rejected ?? 0;
      }
      if (totalRejected > 0) {
        return {
          status: "warn",
          summary: `${totalRejected} search rejection${totalRejected === 1 ? "" : "s"} reported.`,
          observed: { search_rejected: totalRejected },
          recommendation: "Searches are being rejected. Consider reducing query load or scaling.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No search thread pool rejections." };
    },
  },
  // #47
  {
    id: "nodes.thread_pool.write.queue.high",
    domain: "nodes",
    title: "Write thread pool queue high",
    description: "Warns when write thread pool queue exceeds threshold on any node.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodeStats = snapshot.data.nodesCore?.nodeStats?.nodes;
      if (!nodeStats) return unknownNodeStatsResult();
      const nodes = Object.entries(nodeStats);
      for (const [, node] of nodes) {
        const queue = node.thread_pool?.write?.queue ?? 0;
        if (queue >= THREAD_POOL_QUEUE_THRESHOLD) {
          return {
            status: "warn",
            summary: `Write queue at ${queue} on ${node.name ?? "unknown"}.`,
            observed: {
              node: node.name,
              write_queue: queue,
              threshold: THREAD_POOL_QUEUE_THRESHOLD,
            },
            recommendation: "Reduce indexing rate or scale write capacity.",
            links: [{ label: "Cluster Health", to: "/cluster-health" }],
          };
        }
      }
      return { status: "pass", summary: "Write thread pool queues are within threshold." };
    },
  },
  // #48
  {
    id: "nodes.thread_pool.write.rejected.nonzero",
    domain: "nodes",
    title: "Write thread pool rejections",
    description: "Warns when write thread pool rejections are non-zero.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = snapshot.data.nodesCore?.nodeStats?.nodes;
      if (!nodes) return unknownNodeStatsResult();
      let totalRejected = 0;
      for (const node of Object.values(nodes)) {
        totalRejected += node.thread_pool?.write?.rejected ?? 0;
      }
      if (totalRejected > 0) {
        return {
          status: "warn",
          summary: `${totalRejected} write rejection${totalRejected === 1 ? "" : "s"} reported.`,
          observed: { write_rejected: totalRejected },
          recommendation: "Writes are being rejected. Reduce indexing throughput or add capacity.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No write thread pool rejections." };
    },
  },
  // #49
  {
    id: "nodes.thread_pool.bulk.queue.high",
    domain: "nodes",
    title: "Bulk thread pool queue high",
    description: "Warns when bulk thread pool queue exceeds threshold on any node.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodeStats = snapshot.data.nodesCore?.nodeStats?.nodes;
      if (!nodeStats) return unknownNodeStatsResult();
      const nodes = Object.entries(nodeStats);
      for (const [, node] of nodes) {
        const queue = node.thread_pool?.bulk?.queue ?? 0;
        if (queue >= THREAD_POOL_QUEUE_THRESHOLD) {
          return {
            status: "warn",
            summary: `Bulk queue at ${queue} on ${node.name ?? "unknown"}.`,
            observed: {
              node: node.name,
              bulk_queue: queue,
              threshold: THREAD_POOL_QUEUE_THRESHOLD,
            },
            recommendation: "Reduce bulk indexing rate or increase bulk thread pool size.",
            links: [{ label: "Cluster Health", to: "/cluster-health" }],
          };
        }
      }
      return { status: "pass", summary: "Bulk thread pool queues are within threshold." };
    },
  },
  // #50
  {
    id: "nodes.thread_pool.bulk.rejected.nonzero",
    domain: "nodes",
    title: "Bulk thread pool rejections",
    description: "Warns when bulk thread pool rejections are non-zero.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = snapshot.data.nodesCore?.nodeStats?.nodes;
      if (!nodes) return unknownNodeStatsResult();
      let totalRejected = 0;
      for (const node of Object.values(nodes)) {
        totalRejected += node.thread_pool?.bulk?.rejected ?? 0;
      }
      if (totalRejected > 0) {
        return {
          status: "warn",
          summary: `${totalRejected} bulk rejection${totalRejected === 1 ? "" : "s"} reported.`,
          observed: { bulk_rejected: totalRejected },
          recommendation: "Bulk operations are being rejected. Reduce bulk size or scale capacity.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No bulk thread pool rejections." };
    },
  },
  // existing — circuit breaker trips (covers #53–56)
  {
    id: "nodes.breakers.tripped",
    domain: "nodes",
    title: "Circuit breaker trips",
    description: "Warns when breaker trip counters are non-zero.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = snapshot.data.nodesCore?.nodeStats?.nodes;
      if (!nodes) return unknownNodeStatsResult();
      const totalTrips = totalCircuitBreakerTrips(nodes);
      if (totalTrips > 0) {
        return {
          status: "warn",
          summary: `${totalTrips} circuit breaker trip${totalTrips === 1 ? "" : "s"} reported.`,
          observed: { total_trips: totalTrips },
          recommendation: "Investigate memory-intensive operations causing breaker trips.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No circuit breaker trips reported." };
    },
  },
  // existing — thread pool rejections aggregate
  {
    id: "nodes.thread_pool.rejected.nonzero",
    domain: "nodes",
    title: "Thread pool rejections",
    description: "Warns when thread pool rejections are non-zero.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = snapshot.data.nodesCore?.nodeStats?.nodes;
      if (!nodes) return unknownNodeStatsResult();
      const totalRejected = totalThreadPoolRejections(nodes);
      if (totalRejected > 0) {
        return {
          status: "warn",
          summary: `${totalRejected} thread pool rejection${totalRejected === 1 ? "" : "s"} reported.`,
          observed: { total_rejected: totalRejected },
          recommendation: "Thread pool rejections indicate saturation. Reduce load or scale.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No thread pool rejections reported." };
    },
  },
];

import {
  totalCircuitBreakerTrips,
  totalThreadPoolRejections,
} from "../../components/cluster-health/clusterHealthUtils";
import type { NodeStatsNode } from "../../services/es";

import type { HealthCheckDefinition, HealthSnapshot } from "../types";

const FS_AVAILABLE_LOW_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
const THREAD_POOL_QUEUE_THRESHOLD = 200;
const HEAP_PERCENT_HIGH_THRESHOLD = 85;
const CPU_PERCENT_HIGH_THRESHOLD = 90;
const OLD_GC_TIME_HIGH_MS = 5_000;
const YOUNG_GC_TIME_HIGH_MS = 10_000;
const LOAD_1M_HIGH = 10;
const FD_RATIO_HIGH = 0.85;
const FS_USED_HIGH = 0.9;
const HTTP_CURRENT_OPEN_HIGH = 200;
const HTTP_TOTAL_OPENED_BURST = 10_000;
const HOTSPOT_RATIO = 2.0;
const OS_MEM_USED_HIGH = 90;

function getNodes(snapshot: HealthSnapshot): NodeStatsNode[] {
  return Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function sumBreakerTrips(
  nodes: NodeStatsNode[],
  breakerName: string,
): { total: number; affectedNodes: string[] } {
  let total = 0;
  const affectedNodes: string[] = [];
  for (const node of nodes) {
    const tripped = node.breakers?.[breakerName]?.tripped ?? 0;
    if (tripped > 0) {
      total += tripped;
      affectedNodes.push(node.name ?? "unknown");
    }
  }
  return { total, affectedNodes };
}

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
  // #32
  {
    id: "nodes.jvm.old_gc.time.high",
    domain: "nodes",
    title: "Old GC time high",
    description: `Warns when any node old GC collection time > ${OLD_GC_TIME_HIGH_MS}ms.`,
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      const hotNodes = nodes
        .map((n) => ({
          name: n.name ?? "unknown",
          oldGcMs: n.jvm?.gc?.collectors?.old?.collection_time_in_millis ?? 0,
        }))
        .filter((n) => n.oldGcMs > OLD_GC_TIME_HIGH_MS);
      if (hotNodes.length > 0) {
        const worst = hotNodes.sort((a, b) => b.oldGcMs - a.oldGcMs)[0]!;
        return {
          status: "warn",
          summary: `High old GC time on ${worst.name} (${worst.oldGcMs}ms).`,
          observed: { worstNode: worst.name, oldGcMs: worst.oldGcMs },
          recommendation:
            "Investigate heap pressure; consider increasing heap or reducing memory-intensive operations.",
        };
      }
      return { status: "pass", summary: "Old GC collection times within threshold." };
    },
  },
  // #33
  {
    id: "nodes.jvm.young_gc.time.high",
    domain: "nodes",
    title: "Young GC time high",
    description: `Warns when any node young GC collection time > ${YOUNG_GC_TIME_HIGH_MS}ms.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      const hotNodes = nodes
        .map((n) => ({
          name: n.name ?? "unknown",
          youngGcMs: n.jvm?.gc?.collectors?.young?.collection_time_in_millis ?? 0,
        }))
        .filter((n) => n.youngGcMs > YOUNG_GC_TIME_HIGH_MS);
      if (hotNodes.length > 0) {
        const worst = hotNodes.sort((a, b) => b.youngGcMs - a.youngGcMs)[0]!;
        return {
          status: "warn",
          summary: `High young GC time on ${worst.name} (${worst.youngGcMs}ms).`,
          observed: { worstNode: worst.name, youngGcMs: worst.youngGcMs },
          recommendation:
            "High young GC time may indicate high allocation rate or undersized young generation.",
        };
      }
      return { status: "pass", summary: "Young GC collection times within threshold." };
    },
  },
  // #35
  {
    id: "nodes.os.load_1m.high",
    domain: "nodes",
    title: "Node load average (1m) high",
    description: `Warns when any node 1-minute load average > ${LOAD_1M_HIGH}.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      const hotNodes = nodes
        .map((n) => ({ name: n.name ?? "unknown", load1m: n.os?.cpu?.load_average?.["1m"] ?? 0 }))
        .filter((n) => n.load1m > LOAD_1M_HIGH);
      if (hotNodes.length > 0) {
        const worst = hotNodes.sort((a, b) => b.load1m - a.load1m)[0]!;
        return {
          status: "warn",
          summary: `High load average on ${worst.name} (${worst.load1m.toFixed(1)}).`,
          observed: { worstNode: worst.name, load1m: worst.load1m },
          recommendation: "High load average indicates CPU saturation.",
        };
      }
      return { status: "pass", summary: "Node load averages within threshold." };
    },
  },
  // #36
  {
    id: "nodes.process.open_file_descriptors.high",
    domain: "nodes",
    title: "File descriptor usage high",
    description: `Warns when any node open FD / max FD > ${(FD_RATIO_HIGH * 100).toFixed(0)}%.`,
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      const hotNodes = nodes
        .map((n) => {
          const open = n.process?.open_file_descriptors ?? 0;
          const max = n.process?.max_file_descriptors ?? 1;
          return { name: n.name ?? "unknown", ratio: max > 0 ? open / max : 0, open, max };
        })
        .filter((n) => n.ratio > FD_RATIO_HIGH);
      if (hotNodes.length > 0) {
        const worst = hotNodes.sort((a, b) => b.ratio - a.ratio)[0]!;
        return {
          status: "warn",
          summary: `High FD usage on ${worst.name} (${(worst.ratio * 100).toFixed(1)}%).`,
          observed: { worstNode: worst.name, open: worst.open, max: worst.max },
          recommendation:
            "Increase file descriptor limits (ulimit -n) to prevent node instability.",
        };
      }
      return { status: "pass", summary: "File descriptor usage within threshold." };
    },
  },
  // #38
  {
    id: "nodes.fs.used_percent.high",
    domain: "nodes",
    title: "Disk usage percentage high",
    description: `Fails when any node disk usage > ${(FS_USED_HIGH * 100).toFixed(0)}%.`,
    severityOnFail: "critical",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      const hotNodes = nodes
        .map((n) => {
          const total = n.fs?.total?.total_in_bytes ?? 0;
          const available = n.fs?.total?.available_in_bytes ?? 0;
          const used = total > 0 ? (total - available) / total : 0;
          return { name: n.name ?? "unknown", usedPercent: used };
        })
        .filter((n) => n.usedPercent > FS_USED_HIGH);
      if (hotNodes.length > 0) {
        const worst = hotNodes.sort((a, b) => b.usedPercent - a.usedPercent)[0]!;
        return {
          status: "fail",
          summary: `Disk usage on ${worst.name} is ${(worst.usedPercent * 100).toFixed(1)}%.`,
          observed: { worstNode: worst.name, usedPercent: worst.usedPercent },
          recommendation:
            "Free disk space or add nodes. Elasticsearch may enter read-only mode above flood watermark.",
        };
      }
      return { status: "pass", summary: "Disk usage within threshold on all nodes." };
    },
  },
  // #42
  {
    id: "nodes.http.current_open.high",
    domain: "nodes",
    title: "HTTP connections high",
    description: `Warns when any node has > ${HTTP_CURRENT_OPEN_HIGH} HTTP connections open.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      const hotNodes = nodes
        .map((n) => ({ name: n.name ?? "unknown", currentOpen: n.http?.current_open ?? 0 }))
        .filter((n) => n.currentOpen > HTTP_CURRENT_OPEN_HIGH);
      if (hotNodes.length > 0) {
        const worst = hotNodes.sort((a, b) => b.currentOpen - a.currentOpen)[0]!;
        return {
          status: "warn",
          summary: `${worst.currentOpen} HTTP connections on ${worst.name}.`,
          observed: { worstNode: worst.name, currentOpen: worst.currentOpen },
          recommendation: "High HTTP connection count may indicate connection leaks.",
        };
      }
      return { status: "pass", summary: "HTTP connection counts within threshold." };
    },
  },
  // #43
  {
    id: "nodes.http.total_opened.burst_like",
    domain: "nodes",
    title: "HTTP connections burst",
    description: `Warns when any node total opened HTTP connections > ${HTTP_TOTAL_OPENED_BURST}.`,
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      const hotNodes = nodes
        .map((n) => ({ name: n.name ?? "unknown", totalOpened: n.http?.total_opened ?? 0 }))
        .filter((n) => n.totalOpened > HTTP_TOTAL_OPENED_BURST);
      if (hotNodes.length > 0) {
        const worst = hotNodes.sort((a, b) => b.totalOpened - a.totalOpened)[0]!;
        return {
          status: "warn",
          summary: `${worst.totalOpened} total HTTP connections opened on ${worst.name}.`,
          observed: { worstNode: worst.name, totalOpened: worst.totalOpened },
          recommendation: "Consider using persistent connections to reduce churn.",
        };
      }
      return { status: "pass", summary: "HTTP total opened connections within threshold." };
    },
  },
  // #44
  {
    id: "nodes.distribution.hotspotting",
    domain: "nodes",
    title: "Node resource hotspotting",
    description: "Warns when a single node CPU or heap significantly exceeds the cluster median.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      if (nodes.length < 3)
        return { status: "pass", summary: "Too few nodes to detect hotspotting." };
      const cpuValues = nodes.map((n) => n.os?.cpu?.percent ?? 0);
      const heapValues = nodes.map((n) => n.jvm?.mem?.heap_used_percent ?? 0);
      const cpuMed = median(cpuValues);
      const heapMed = median(heapValues);
      const hotspots: string[] = [];
      for (const node of nodes) {
        const cpu = node.os?.cpu?.percent ?? 0;
        const heap = node.jvm?.mem?.heap_used_percent ?? 0;
        const name = node.name ?? "unknown";
        if (cpuMed > 0 && cpu / cpuMed >= HOTSPOT_RATIO && cpu > 50) hotspots.push(`${name} (CPU)`);
        if (heapMed > 0 && heap / heapMed >= HOTSPOT_RATIO && heap > 50)
          hotspots.push(`${name} (Heap)`);
      }
      if (hotspots.length > 0) {
        return {
          status: "warn",
          summary: `Resource hotspot detected: ${hotspots[0]}.`,
          observed: { hotspots },
          recommendation: "Check for uneven shard distribution or query routing bias.",
        };
      }
      return { status: "pass", summary: "No resource hotspotting detected." };
    },
  },
  // #51
  {
    id: "nodes.thread_pool.management.queue.high",
    domain: "nodes",
    title: "Management thread pool queue high",
    description: `Warns when management thread pool queue > ${THREAD_POOL_QUEUE_THRESHOLD} on any node.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      for (const node of nodes) {
        const queue = node.thread_pool?.management?.queue ?? 0;
        if (queue > THREAD_POOL_QUEUE_THRESHOLD) {
          return {
            status: "warn",
            summary: `Management pool queue ${queue} on ${node.name ?? "unknown"}.`,
            observed: { node: node.name, queue },
            recommendation:
              "High management queue indicates master/coordination thread saturation.",
          };
        }
      }
      return { status: "pass", summary: "Management thread pool queues within threshold." };
    },
  },
  // #52
  {
    id: "nodes.thread_pool.snapshot.queue.high",
    domain: "nodes",
    title: "Snapshot thread pool queue high",
    description: `Warns when snapshot thread pool queue > ${THREAD_POOL_QUEUE_THRESHOLD} on any node.`,
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      for (const node of nodes) {
        const queue = node.thread_pool?.snapshot?.queue ?? 0;
        if (queue > THREAD_POOL_QUEUE_THRESHOLD) {
          return {
            status: "warn",
            summary: `Snapshot pool queue ${queue} on ${node.name ?? "unknown"}.`,
            observed: { node: node.name, queue },
            recommendation:
              "High snapshot queue may indicate too many concurrent snapshot operations.",
          };
        }
      }
      return { status: "pass", summary: "Snapshot thread pool queues within threshold." };
    },
  },
  // #53
  {
    id: "nodes.breaker.parent.tripped.nonzero",
    domain: "nodes",
    title: "Parent circuit breaker tripped",
    description: "Warns when the parent circuit breaker has been tripped.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const { total, affectedNodes } = sumBreakerTrips(getNodes(snapshot), "parent");
      if (total > 0) {
        return {
          status: "warn",
          summary: `Parent breaker tripped ${total} time${total === 1 ? "" : "s"}.`,
          observed: { total, affectedNodes },
          recommendation: "Parent breaker trips indicate total memory pressure.",
        };
      }
      return { status: "pass", summary: "No parent circuit breaker trips." };
    },
  },
  // #54
  {
    id: "nodes.breaker.request.tripped.nonzero",
    domain: "nodes",
    title: "Request circuit breaker tripped",
    description: "Warns when the request circuit breaker has been tripped.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const { total, affectedNodes } = sumBreakerTrips(getNodes(snapshot), "request");
      if (total > 0) {
        return {
          status: "warn",
          summary: `Request breaker tripped ${total} time${total === 1 ? "" : "s"}.`,
          observed: { total, affectedNodes },
          recommendation:
            "Request breaker trips indicate individual requests consuming too much memory.",
        };
      }
      return { status: "pass", summary: "No request circuit breaker trips." };
    },
  },
  // #55
  {
    id: "nodes.breaker.fielddata.tripped.nonzero",
    domain: "nodes",
    title: "Fielddata circuit breaker tripped",
    description: "Warns when the fielddata circuit breaker has been tripped.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const { total, affectedNodes } = sumBreakerTrips(getNodes(snapshot), "fielddata");
      if (total > 0) {
        return {
          status: "warn",
          summary: `Fielddata breaker tripped ${total} time${total === 1 ? "" : "s"}.`,
          observed: { total, affectedNodes },
          recommendation: "Consider using doc values instead of fielddata.",
        };
      }
      return { status: "pass", summary: "No fielddata circuit breaker trips." };
    },
  },
  // #56
  {
    id: "nodes.breaker.inflight_requests.tripped.nonzero",
    domain: "nodes",
    title: "In-flight requests breaker tripped",
    description: "Warns when the in-flight requests circuit breaker has been tripped.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const { total, affectedNodes } = sumBreakerTrips(getNodes(snapshot), "in_flight_requests");
      if (total > 0) {
        return {
          status: "warn",
          summary: `In-flight requests breaker tripped ${total} time${total === 1 ? "" : "s"}.`,
          observed: { total, affectedNodes },
          recommendation: "Reduce concurrent request volume.",
        };
      }
      return { status: "pass", summary: "No in-flight requests circuit breaker trips." };
    },
  },
  // nodes.os.mem.used_percent.high
  {
    id: "nodes.os.mem.used_percent.high",
    domain: "nodes",
    title: "Node OS memory usage high",
    description: "Warns when any node OS memory usage >= 90%.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      const hotNodes = nodes
        .map((n) => ({ name: n.name ?? "unknown", memPct: n.os?.mem?.used_percent ?? 0 }))
        .filter((n) => n.memPct >= OS_MEM_USED_HIGH);
      if (hotNodes.length > 0) {
        const worst = hotNodes.sort((a, b) => b.memPct - a.memPct)[0]!;
        return {
          status: "warn",
          summary: `High OS memory on ${worst.name} (${worst.memPct}%).`,
          observed: { worstNode: worst.name, memPercent: worst.memPct },
          recommendation: "High OS memory usage may trigger OOM killer.",
        };
      }
      return { status: "pass", summary: "OS memory usage within threshold." };
    },
  },
];

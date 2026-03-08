import { totalCircuitBreakerTrips } from "../../components/cluster-health/clusterHealthUtils";
import type { NodeStatsNode } from "../../services/es";

import type { HealthCheckDefinition, HealthSnapshot } from "../types";

const FS_AVAILABLE_LOW_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
const THREAD_POOL_QUEUE_THRESHOLD = 200;
const HEAP_PERCENT_HIGH_THRESHOLD = 85;
const HEAP_PERCENT_WARNING_THRESHOLD = 75;
const CPU_PERCENT_HIGH_THRESHOLD = 90;
const LOAD_1M_HIGH = 10;
const FD_RATIO_HIGH = 0.85;
const FS_USED_HIGH = 0.9;
const HTTP_CURRENT_OPEN_HIGH = 200;
const HOTSPOT_RATIO = 2.0;
const OS_MEM_USED_HIGH = 90;

function isVotingOnlyNode(roles: string[] | undefined): boolean {
  return Boolean(roles?.includes("voting_only"));
}

function getNodes(snapshot: HealthSnapshot): NodeStatsNode[] {
  return Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
}

function getEligibleNodes(snapshot: HealthSnapshot): NodeStatsNode[] {
  return getNodes(snapshot).filter((node) => !isVotingOnlyNode(node.roles));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
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
    description:
      "Warns when any data/master node JVM heap usage is >= 85%. Voting-only tiebreaker nodes are excluded.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/jvm-settings",
    recommendation:
      "High heap pressure increases GC pauses and risks OOM kills. Consider increasing heap size or reducing cache/fielddata usage.",
    evaluate: (snapshot) => {
      const nodeStats = snapshot.data.nodesCore?.nodeStats?.nodes;
      if (!nodeStats) return unknownNodeStatsResult();
      const nodes = getEligibleNodes(snapshot);
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
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation: "Investigate heavy queries or indexing load on the node.",
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
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/cluster-level-shard-allocation-and-routing-settings",
    recommendation:
      "Low disk triggers shard allocation restrictions. Delete old indices, add storage, or adjust watermark settings.",
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
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/thread-pool-settings",
    recommendation: "Reduce search concurrency or scale search capacity.",
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
  // #47
  {
    id: "nodes.thread_pool.write.queue.high",
    domain: "nodes",
    title: "Write thread pool queue high",
    description: "Warns when write thread pool queue exceeds threshold on any node.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/thread-pool-settings",
    recommendation: "Reduce indexing rate or scale write capacity.",
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
  // #49
  {
    id: "nodes.thread_pool.bulk.queue.high",
    domain: "nodes",
    title: "Bulk thread pool queue high",
    description: "Warns when bulk thread pool queue exceeds threshold on any node.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/thread-pool-settings",
    recommendation: "Reduce bulk indexing rate or increase bulk thread pool size.",
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
  // existing — circuit breaker trips (covers #53–56)
  {
    id: "nodes.breakers.tripped",
    domain: "nodes",
    title: "Circuit breaker trips",
    description: "Warns when breaker trip counters are non-zero.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/circuit-breaker-settings",
    recommendation:
      "Investigate memory-intensive operations causing breaker trips. Review fielddata, in-flight requests, and aggregations.",
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
  // #35
  {
    id: "nodes.os.load_1m.high",
    domain: "nodes",
    title: "Node load average (1m) high",
    description: `Warns when any node 1-minute load average > ${LOAD_1M_HIGH}.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation: "High load average indicates CPU saturation.",
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
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation: "Increase file descriptor limits (ulimit -n) to prevent node instability.",
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
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/cluster-level-shard-allocation-and-routing-settings",
    recommendation:
      "Free disk space or add nodes. Elasticsearch may enter read-only mode above flood watermark.",
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
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation: "High HTTP connection count may indicate connection leaks.",
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
  // #44
  {
    id: "nodes.distribution.hotspotting",
    domain: "nodes",
    title: "Node resource hotspotting",
    description: "Warns when a single node CPU or heap significantly exceeds the cluster median.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation: "Check for uneven shard distribution or query routing bias.",
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
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/thread-pool-settings",
    recommendation: "High management queue indicates master/coordination thread saturation.",
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
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/thread-pool-settings",
    recommendation: "High snapshot queue may indicate too many concurrent snapshot operations.",
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
  // nodes.os.mem.used_percent.high
  {
    id: "nodes.os.mem.used_percent.high",
    domain: "nodes",
    title: "Node OS memory usage high",
    description: "Warns when any node OS memory usage >= 90%.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation: "High OS memory usage may trigger OOM killer.",
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
  // --- Extra checks added by this PR ---
  // Heap warning (75%)
  {
    id: "nodes.jvm.heap_percent.warning",
    domain: "nodes",
    title: "Node heap utilization warning",
    description: `Warns when any data/master node JVM heap usage is >= ${HEAP_PERCENT_WARNING_THRESHOLD}%. Voting-only nodes excluded.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/jvm-settings",
    recommendation:
      "Heap above 75% is a warning sign. Monitor trends and consider scaling before hitting critical thresholds.",
    evaluate: (snapshot) => {
      const nodes = getEligibleNodes(snapshot);
      const hottestNode = nodes
        .map((node) => ({
          name: node.name ?? "unknown",
          heap: node.jvm?.mem?.heap_used_percent ?? 0,
        }))
        .sort((a, b) => b.heap - a.heap)[0];

      if (
        (hottestNode?.heap ?? 0) >= HEAP_PERCENT_WARNING_THRESHOLD &&
        (hottestNode?.heap ?? 0) < HEAP_PERCENT_HIGH_THRESHOLD
      ) {
        return {
          status: "warn",
          summary: `Elevated JVM heap on ${hottestNode?.name} (${hottestNode?.heap}%).`,
          observed: { node: hottestNode?.name, heap_used_percent: hottestNode?.heap },
          recommendation:
            "Monitor heap trends and consider scaling before hitting critical levels.",
        };
      }
      return { status: "pass", summary: "Node JVM heap utilization is below warning threshold." };
    },
  },
  // Indexing latency
  {
    id: "nodes.indices.indexing.latency.high",
    domain: "nodes",
    title: "Indexing latency",
    description: "Warns when average indexing latency exceeds 20ms per document on any node.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "High indexing latency may indicate slow disks, heavy merges, or complex ingest pipelines.",
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      for (const node of nodes) {
        const total = node.indices?.indexing?.index_total ?? 0;
        const timeMs = node.indices?.indexing?.index_time_in_millis ?? 0;
        if (total > 1000) {
          const avgMs = timeMs / total;
          if (avgMs >= 20) {
            return {
              status: "warn",
              summary: `High indexing latency on ${node.name ?? "unknown"} — avg ${avgMs.toFixed(1)}ms/doc.`,
              observed: { node: node.name, avgMs: +avgMs.toFixed(1), totalDocs: total },
            };
          }
        }
      }
      return { status: "pass", summary: "Indexing latency is within threshold." };
    },
  },
  // Translog uncommitted
  {
    id: "nodes.indices.translog.uncommitted.high",
    domain: "nodes",
    title: "Translog uncommitted operations",
    description:
      "Warns when translog has many uncommitted operations, indicating slow flushes and recovery risk.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "Large translogs slow recovery and increase memory pressure. Check flush frequency and disk I/O.",
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      for (const node of nodes) {
        const uncommitted = node.indices?.translog?.uncommitted_operations ?? 0;
        if (uncommitted >= 100_000) {
          return {
            status: "warn",
            summary: `${node.name ?? "unknown"} has ${uncommitted.toLocaleString()} uncommitted translog operations.`,
            observed: { node: node.name, uncommittedOps: uncommitted },
          };
        }
      }
      return { status: "pass", summary: "Translog uncommitted operations are normal." };
    },
  },
  // Refresh latency
  {
    id: "nodes.indices.refresh.latency.high",
    domain: "nodes",
    title: "Refresh latency",
    description:
      "Warns when average refresh latency exceeds 500ms — near-real-time search may lag.",
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "High refresh latency delays search visibility. Consider increasing refresh_interval.",
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      for (const node of nodes) {
        const total = node.indices?.refresh?.total ?? 0;
        const timeMs = node.indices?.refresh?.total_time_in_millis ?? 0;
        if (total > 100) {
          const avgMs = timeMs / total;
          if (avgMs >= 500) {
            return {
              status: "warn",
              summary: `High refresh latency on ${node.name ?? "unknown"} — avg ${avgMs.toFixed(0)}ms.`,
              observed: { node: node.name, avgRefreshMs: +avgMs.toFixed(0) },
            };
          }
        }
      }
      return { status: "pass", summary: "Refresh latency is within threshold." };
    },
  },
  // Search query latency
  {
    id: "nodes.indices.search.query_latency.high",
    domain: "nodes",
    title: "Search query latency",
    description: "Warns when average search query latency exceeds 100ms on any node.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "High search latency degrades user experience. Profile slow queries and optimize mappings.",
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      for (const node of nodes) {
        const total = node.indices?.search?.query_total ?? 0;
        const timeMs = node.indices?.search?.query_time_in_millis ?? 0;
        if (total > 100) {
          const avgMs = timeMs / total;
          if (avgMs >= 100) {
            return {
              status: "warn",
              summary: `High search latency on ${node.name ?? "unknown"} — avg ${avgMs.toFixed(0)}ms/query.`,
              observed: { node: node.name, avgQueryMs: +avgMs.toFixed(0), totalQueries: total },
            };
          }
        }
      }
      return { status: "pass", summary: "Search query latency is within threshold." };
    },
  },
  // Search fetch latency
  {
    id: "nodes.indices.search.fetch_latency.high",
    domain: "nodes",
    title: "Search fetch latency",
    description: "Warns when average search fetch latency exceeds 100ms on any node.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "High fetch latency may indicate large result sets. Reduce _source size or use source filtering.",
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      for (const node of nodes) {
        const total = node.indices?.search?.fetch_total ?? 0;
        const timeMs = node.indices?.search?.fetch_time_in_millis ?? 0;
        if (total > 100) {
          const avgMs = timeMs / total;
          if (avgMs >= 100) {
            return {
              status: "warn",
              summary: `High fetch latency on ${node.name ?? "unknown"} — avg ${avgMs.toFixed(0)}ms/fetch.`,
              observed: { node: node.name, avgFetchMs: +avgMs.toFixed(0), totalFetches: total },
            };
          }
        }
      }
      return { status: "pass", summary: "Search fetch latency is within threshold." };
    },
  },
  // Open scroll contexts
  {
    id: "nodes.indices.search.open_contexts.high",
    domain: "nodes",
    title: "Open scroll contexts",
    description:
      "Warns when open scroll/search contexts are high — they consume heap and can cause OOM.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "Open scroll contexts hold resources until closed or timed out. Check for scroll leaks.",
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      let totalOpen = 0;
      for (const node of nodes) {
        totalOpen += node.indices?.search?.open_contexts ?? 0;
      }
      if (totalOpen >= 100) {
        return {
          status: "warn",
          summary: `${totalOpen} open scroll/search contexts across cluster.`,
          observed: { totalOpenContexts: totalOpen },
        };
      }
      return { status: "pass", summary: "Open scroll context count is normal." };
    },
  },
  // Deleted documents ratio
  {
    id: "nodes.indices.docs.deleted_ratio.high",
    domain: "nodes",
    title: "Deleted documents ratio",
    description:
      "Warns when deleted documents exceed 20% of total — wasted disk and heap from unmerged deletes.",
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "High deleted doc ratios waste resources. Consider force-merging read-only indices.",
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      let totalDocs = 0;
      let totalDeleted = 0;
      for (const node of nodes) {
        totalDocs += node.indices?.docs?.count ?? 0;
        totalDeleted += node.indices?.docs?.deleted ?? 0;
      }
      const total = totalDocs + totalDeleted;
      if (total > 10_000 && totalDeleted / total >= 0.2) {
        const pct = +((totalDeleted / total) * 100).toFixed(1);
        return {
          status: "warn",
          summary: `${pct}% of documents are deleted but unmerged (${totalDeleted.toLocaleString()} deleted).`,
          observed: { totalDocs, totalDeleted, deletedPercent: pct },
        };
      }
      return { status: "pass", summary: "Deleted document ratio is normal." };
    },
  },
  // Segment memory
  {
    id: "nodes.indices.segments.memory.high",
    domain: "nodes",
    title: "Segment memory usage",
    description: "Warns when segment memory is a large portion of heap on any node.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "High segment memory reduces available heap. Reduce shard count or force-merge old indices.",
    evaluate: (snapshot) => {
      const nodes = getEligibleNodes(snapshot);
      for (const node of nodes) {
        const segMem = node.indices?.segments?.memory_in_bytes ?? 0;
        const heapMax = node.jvm?.mem?.heap_max_in_bytes ?? 0;
        if (heapMax > 0 && segMem / heapMax >= 0.5) {
          const pct = +((segMem / heapMax) * 100).toFixed(1);
          return {
            status: "warn",
            summary: `Segment memory on ${node.name ?? "unknown"} is ${pct}% of heap.`,
            observed: {
              node: node.name,
              segmentMemGb: +(segMem / 1e9).toFixed(1),
              heapMaxGb: +(heapMax / 1e9).toFixed(1),
              percent: pct,
            },
          };
        }
      }
      return { status: "pass", summary: "Segment memory usage is within threshold." };
    },
  },
  // Query cache evictions
  {
    id: "nodes.indices.query_cache.evictions.high",
    domain: "nodes",
    title: "Query cache evictions",
    description: "Warns when query cache evictions are high relative to cache count.",
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "High query cache evictions reduce search performance. Consider increasing indices.queries.cache.size.",
    evaluate: (snapshot) => {
      const nodes = getNodes(snapshot);
      let totalEvictions = 0;
      let totalCacheCount = 0;
      for (const node of nodes) {
        totalEvictions += node.indices?.query_cache?.evictions ?? 0;
        totalCacheCount += node.indices?.query_cache?.cache_count ?? 0;
      }
      if (totalCacheCount > 100 && totalEvictions / totalCacheCount >= 0.5) {
        return {
          status: "warn",
          summary: `Query cache eviction ratio ${((totalEvictions / totalCacheCount) * 100).toFixed(0)}%.`,
          observed: { totalEvictions, totalCacheCount },
        };
      }
      return { status: "pass", summary: "Query cache eviction rate is normal." };
    },
  },
];

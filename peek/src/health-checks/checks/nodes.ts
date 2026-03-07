import {
  totalCircuitBreakerTrips,
  totalThreadPoolRejections,
} from "../../components/cluster-health/clusterHealthUtils";
import type { NodeStatsNode } from "../../services/es/clusterTypes";

import type { HealthCheckDefinition } from "../types";

function isVotingOnlyNode(roles: string[] | undefined): boolean {
  return Boolean(roles?.includes("voting_only"));
}

function getEligibleNodes(nodes: Record<string, NodeStatsNode>): NodeStatsNode[] {
  return Object.values(nodes).filter((node) => !isVotingOnlyNode(node.roles));
}

export const nodesChecks: HealthCheckDefinition[] = [
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
      "High heap pressure increases GC pauses and risks OOM kills. Consider increasing heap size (up to 50% of RAM, max ~31 GB) or reducing cache/fielddata usage.",
    evaluate: (snapshot) => {
      const nodes = getEligibleNodes(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      const hottestNode = nodes
        .map((node) => ({
          name: node.name ?? "unknown",
          heap: node.jvm?.mem?.heap_used_percent ?? 0,
        }))
        .sort((a, b) => b.heap - a.heap)[0];

      if ((hottestNode?.heap ?? 0) >= 85) {
        return {
          status: "warn",
          summary: `High JVM heap on ${hottestNode?.name} (${hottestNode?.heap}%).`,
          observed: { hottestNode },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "Node JVM heap utilization is within threshold." };
    },
  },
  {
    id: "nodes.jvm.old_gc.time.high",
    domain: "nodes",
    title: "Old GC collection time",
    description:
      "Warns when old-generation GC time is high on any node, indicating heap pressure and potential stop-the-world pauses.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/jvm-settings",
    recommendation:
      "High old GC time causes latency spikes. Reduce heap pressure by lowering fielddata, reducing concurrent searches, or increasing heap size.",
    evaluate: (snapshot) => {
      const nodes = getEligibleNodes(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      const worst = nodes
        .map((node) => ({
          name: node.name ?? "unknown",
          oldGcMs: node.jvm?.gc?.collectors?.old?.collection_time_in_millis ?? 0,
          oldGcCount: node.jvm?.gc?.collectors?.old?.collection_count ?? 0,
        }))
        .filter((n) => n.oldGcCount > 0)
        .sort((a, b) => b.oldGcMs - a.oldGcMs)[0];

      if (worst && worst.oldGcMs > 0 && worst.oldGcCount > 0) {
        const avgMs = Math.round(worst.oldGcMs / worst.oldGcCount);
        if (avgMs >= 500) {
          return {
            status: "warn",
            summary: `High old GC on ${worst.name} — avg ${avgMs}ms per collection (${worst.oldGcCount} collections).`,
            observed: { node: worst.name, avgMs, totalMs: worst.oldGcMs, count: worst.oldGcCount },
            links: [{ label: "Nodes", to: "/nodes" }],
          };
        }
      }
      return { status: "pass", summary: "Old GC collection times are within threshold." };
    },
  },
  {
    id: "nodes.cpu.percent.high",
    domain: "nodes",
    title: "Node CPU utilization",
    description: "Warns when any node CPU usage is >= 90%.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "Sustained high CPU may indicate heavy query load, large merges, or insufficient capacity. Check hot threads for root cause.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      const hottestNode = nodes
        .map((node) => ({ name: node.name ?? "unknown", cpu: node.os?.cpu?.percent ?? 0 }))
        .sort((a, b) => b.cpu - a.cpu)[0];

      if ((hottestNode?.cpu ?? 0) >= 90) {
        return {
          status: "warn",
          summary: `High CPU on ${hottestNode?.name} (${hottestNode?.cpu}%).`,
          observed: { hottestNode },
          links: [{ label: "Nodes", to: "/nodes" }],
        };
      }
      return { status: "pass", summary: "Node CPU utilization is within threshold." };
    },
  },
  {
    id: "nodes.os.load_1m.high",
    domain: "nodes",
    title: "Load average (1m)",
    description: "Warns when 1-minute load average exceeds 2x the number of available processors.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "High load average means more work is queued than the CPU can handle. Investigate runaway queries or reduce concurrent operations.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      for (const node of nodes) {
        const load1m = node.os?.cpu?.load_average?.["1m"] ?? 0;
        // Assume 8 cores if not available — conservative
        if (load1m >= 16) {
          return {
            status: "warn",
            summary: `High 1m load average on ${node.name ?? "unknown"} (${load1m.toFixed(1)}).`,
            observed: { node: node.name, load1m },
            links: [{ label: "Nodes", to: "/nodes" }],
          };
        }
      }
      return { status: "pass", summary: "Load averages are within threshold." };
    },
  },
  {
    id: "nodes.process.open_file_descriptors.high",
    domain: "nodes",
    title: "File descriptor usage",
    description: "Warns when any node is using more than 80% of its file descriptor limit.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "Running out of file descriptors causes index failures. Increase ulimits or investigate high shard/segment counts.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      for (const node of nodes) {
        const open = node.process?.open_file_descriptors ?? 0;
        const max = node.process?.max_file_descriptors ?? 0;
        if (max > 0 && open / max >= 0.8) {
          const pct = Math.round((open / max) * 100);
          return {
            status: "warn",
            summary: `${node.name ?? "unknown"} using ${pct}% of file descriptors (${open}/${max}).`,
            observed: { node: node.name, open, max, percent: pct },
            links: [{ label: "Nodes", to: "/nodes" }],
          };
        }
      }
      return { status: "pass", summary: "File descriptor usage is within limits." };
    },
  },
  {
    id: "nodes.fs.available.low",
    domain: "nodes",
    title: "Disk space available",
    description:
      "Warns when any node has less than 15% disk space available (approaching Elasticsearch low watermark).",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/configuration-reference/cluster-level-shard-allocation-and-routing-settings",
    recommendation:
      "Low disk triggers shard allocation restrictions. Delete old indices, add storage, or adjust watermark settings.",
    evaluate: (snapshot) => {
      const nodes = getEligibleNodes(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      for (const node of nodes) {
        const total = node.fs?.total?.total_in_bytes ?? 0;
        const available = node.fs?.total?.available_in_bytes ?? 0;
        if (total > 0) {
          const pctAvailable = (available / total) * 100;
          if (pctAvailable < 15) {
            return {
              status: "warn",
              summary: `Low disk on ${node.name ?? "unknown"} — ${pctAvailable.toFixed(1)}% available (${(available / 1e9).toFixed(1)} GB).`,
              observed: {
                node: node.name,
                availableGb: +(available / 1e9).toFixed(1),
                totalGb: +(total / 1e9).toFixed(1),
                pctAvailable: +pctAvailable.toFixed(1),
              },
              links: [{ label: "Nodes", to: "/nodes" }],
            };
          }
        }
      }
      return { status: "pass", summary: "Disk space is adequate on all nodes." };
    },
  },
  {
    id: "nodes.http.current_open.high",
    domain: "nodes",
    title: "HTTP connections",
    description: "Warns when any node has more than 500 open HTTP connections.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "High HTTP connection counts may indicate client connection leaks or insufficient load balancing.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      for (const node of nodes) {
        const open = node.http?.current_open ?? 0;
        if (open >= 500) {
          return {
            status: "warn",
            summary: `${node.name ?? "unknown"} has ${open} open HTTP connections.`,
            observed: { node: node.name, currentOpen: open },
            links: [{ label: "Nodes", to: "/nodes" }],
          };
        }
      }
      return { status: "pass", summary: "HTTP connection counts are normal." };
    },
  },
  {
    id: "nodes.breakers.tripped",
    domain: "nodes",
    title: "Circuit breaker trips",
    description:
      "Warns when circuit breaker trip counters are non-zero. Trips indicate memory pressure caught before OOM.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/circuit-breaker-settings",
    recommendation:
      "Review fielddata usage, in-flight request sizes, and aggregation complexity. Consider increasing heap or adding nodes.",
    evaluate: (snapshot) => {
      const totalTrips = totalCircuitBreakerTrips(snapshot.data.nodesCore?.nodeStats?.nodes);
      if (totalTrips > 0) {
        return {
          status: "warn",
          summary: `${totalTrips} circuit breaker trip${totalTrips === 1 ? "" : "s"} reported.`,
          observed: { totalTrips },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No circuit breaker trips reported." };
    },
  },
  {
    id: "nodes.breaker.parent.tripped",
    domain: "nodes",
    title: "Parent circuit breaker trips",
    description:
      "Warns when the parent circuit breaker has tripped. This breaker is the last line of defense against OOM.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/circuit-breaker-settings",
    recommendation:
      "Parent breaker trips are serious — the node nearly ran out of memory. Reduce heap pressure urgently.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      let totalParentTrips = 0;
      const affected: string[] = [];
      for (const node of nodes) {
        const trips = node.breakers?.parent?.tripped ?? 0;
        if (trips > 0) {
          totalParentTrips += trips;
          affected.push(node.name ?? "unknown");
        }
      }
      if (totalParentTrips > 0) {
        return {
          status: "warn",
          summary: `Parent circuit breaker tripped ${totalParentTrips} time${totalParentTrips === 1 ? "" : "s"} on ${affected.join(", ")}.`,
          observed: { totalParentTrips, affectedNodes: affected },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No parent circuit breaker trips." };
    },
  },
  {
    id: "nodes.breaker.fielddata.tripped",
    domain: "nodes",
    title: "Fielddata breaker trips",
    description:
      "Warns when fielddata circuit breaker has tripped, indicating heavy text field aggregations.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/circuit-breaker-settings",
    recommendation:
      "Fielddata breaker trips often indicate aggregations on text fields. Use keyword fields for aggregations instead.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      let total = 0;
      for (const node of nodes) {
        total += node.breakers?.fielddata?.tripped ?? 0;
      }
      if (total > 0) {
        return {
          status: "warn",
          summary: `Fielddata circuit breaker tripped ${total} time${total === 1 ? "" : "s"}.`,
          observed: { totalTrips: total },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No fielddata breaker trips." };
    },
  },
  {
    id: "nodes.thread_pool.rejected.nonzero",
    domain: "nodes",
    title: "Thread pool rejections",
    description:
      "Warns when thread pool rejections (write, search, get) are non-zero. Rejections mean work items were dropped.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/thread-pool-settings",
    recommendation:
      "Rejections indicate the cluster cannot keep up with request volume. Scale out, reduce indexing rate, or optimize queries.",
    evaluate: (snapshot) => {
      const totalRejected = totalThreadPoolRejections(snapshot.data.nodesCore?.nodeStats?.nodes);
      if (totalRejected > 0) {
        return {
          status: "warn",
          summary: `${totalRejected} thread pool rejection${totalRejected === 1 ? "" : "s"} reported.`,
          observed: { totalRejected },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No thread pool rejections reported." };
    },
  },
  {
    id: "nodes.thread_pool.search.rejected",
    domain: "nodes",
    title: "Search rejections",
    description: "Warns when search thread pool rejections are non-zero.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/thread-pool-settings",
    recommendation:
      "Search rejections mean queries are being dropped. Reduce query rate, optimize slow queries, or add search capacity.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      let total = 0;
      for (const node of nodes) {
        total += node.thread_pool?.search?.rejected ?? 0;
      }
      if (total > 0) {
        return {
          status: "warn",
          summary: `${total} search thread pool rejection${total === 1 ? "" : "s"}.`,
          observed: { totalSearchRejections: total },
          links: [{ label: "Nodes", to: "/nodes" }],
        };
      }
      return { status: "pass", summary: "No search rejections." };
    },
  },
  {
    id: "nodes.thread_pool.write.rejected",
    domain: "nodes",
    title: "Write rejections",
    description: "Warns when write thread pool rejections are non-zero — indexing requests are being dropped.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/thread-pool-settings",
    recommendation:
      "Write rejections cause data loss at the client. Reduce indexing rate, increase bulk sizes, or add data nodes.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      let total = 0;
      for (const node of nodes) {
        total += node.thread_pool?.write?.rejected ?? 0;
      }
      if (total > 0) {
        return {
          status: "warn",
          summary: `${total} write thread pool rejection${total === 1 ? "" : "s"}.`,
          observed: { totalWriteRejections: total },
          links: [{ label: "Nodes", to: "/nodes" }],
        };
      }
      return { status: "pass", summary: "No write rejections." };
    },
  },
  {
    id: "nodes.thread_pool.search.queue.high",
    domain: "nodes",
    title: "Search queue depth",
    description: "Warns when search thread pool queues are deep (>= 500), indicating search pressure.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/thread-pool-settings",
    recommendation:
      "Deep search queues precede rejections. Optimize slow queries, reduce concurrent searches, or add search-tier nodes.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      for (const node of nodes) {
        const queued = node.thread_pool?.search?.queue ?? 0;
        if (queued >= 500) {
          return {
            status: "warn",
            summary: `Search queue depth ${queued} on ${node.name ?? "unknown"}.`,
            observed: { node: node.name, searchQueueDepth: queued },
            links: [{ label: "Nodes", to: "/nodes" }],
          };
        }
      }
      return { status: "pass", summary: "Search queue depths are normal." };
    },
  },
  {
    id: "nodes.thread_pool.write.queue.high",
    domain: "nodes",
    title: "Write queue depth",
    description: "Warns when write thread pool queues are deep (>= 200), indicating indexing pressure.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/thread-pool-settings",
    recommendation:
      "Deep write queues precede rejections. Reduce bulk indexing rate, increase bulk sizes, or add data nodes.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      for (const node of nodes) {
        const queued = node.thread_pool?.write?.queue ?? 0;
        if (queued >= 200) {
          return {
            status: "warn",
            summary: `Write queue depth ${queued} on ${node.name ?? "unknown"}.`,
            observed: { node: node.name, writeQueueDepth: queued },
            links: [{ label: "Nodes", to: "/nodes" }],
          };
        }
      }
      return { status: "pass", summary: "Write queue depths are normal." };
    },
  },
  {
    id: "nodes.distribution.hotspotting",
    domain: "nodes",
    title: "Node hotspotting",
    description:
      "Warns when one node has significantly higher CPU or heap than the median, indicating uneven load distribution.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "Hotspotting may indicate uneven shard distribution, hot indices on a single node, or client routing issues.",
    evaluate: (snapshot) => {
      const nodes = getEligibleNodes(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      if (nodes.length < 3) {
        return { status: "pass", summary: "Too few nodes to assess hotspotting." };
      }
      const cpus = nodes.map((n) => n.os?.cpu?.percent ?? 0).sort((a, b) => a - b);
      const median = cpus[Math.floor(cpus.length / 2)] ?? 0;
      const max = cpus[cpus.length - 1] ?? 0;
      if (median > 0 && max > 50 && max / median >= 3) {
        const hotNode = nodes.find((n) => (n.os?.cpu?.percent ?? 0) === max);
        return {
          status: "warn",
          summary: `CPU hotspot: ${hotNode?.name ?? "unknown"} at ${max}% vs median ${median}%.`,
          observed: { hotNode: hotNode?.name, maxCpu: max, medianCpu: median },
          links: [{ label: "Nodes", to: "/nodes" }],
        };
      }
      return { status: "pass", summary: "No significant node hotspotting detected." };
    },
  },
  {
    id: "nodes.ingest.pipeline.failures",
    domain: "nodes",
    title: "Ingest pipeline failures",
    description: "Warns when ingest pipeline failure counts are non-zero across nodes.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "Ingest failures mean documents are being rejected. Check pipeline processor configurations and input data quality.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      let totalFailed = 0;
      for (const node of nodes) {
        totalFailed += node.ingest?.total?.failed ?? 0;
      }
      if (totalFailed > 0) {
        return {
          status: "warn",
          summary: `${totalFailed} ingest pipeline failure${totalFailed === 1 ? "" : "s"} across cluster.`,
          observed: { totalFailed },
          links: [{ label: "Ingest Pipelines", to: "/ingest-pipelines" }],
        };
      }
      return { status: "pass", summary: "No ingest pipeline failures." };
    },
  },
  {
    id: "nodes.jvm.heap_percent.warning",
    domain: "nodes",
    title: "Node heap utilization warning",
    description:
      "Warns when any data/master node JVM heap usage is >= 75%. Voting-only tiebreaker nodes are excluded.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/jvm-settings",
    recommendation:
      "Heap above 75% is a warning sign. Monitor trends and consider scaling before hitting critical thresholds.",
    evaluate: (snapshot) => {
      const nodes = getEligibleNodes(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      const hottestNode = nodes
        .map((node) => ({
          name: node.name ?? "unknown",
          heap: node.jvm?.mem?.heap_used_percent ?? 0,
        }))
        .sort((a, b) => b.heap - a.heap)[0];

      if ((hottestNode?.heap ?? 0) >= 75 && (hottestNode?.heap ?? 0) < 85) {
        return {
          status: "warn",
          summary: `Elevated JVM heap on ${hottestNode?.name} (${hottestNode?.heap}%).`,
          observed: { hottestNode },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "Node JVM heap utilization is below warning threshold." };
    },
  },
  {
    id: "nodes.indices.fielddata.evictions",
    domain: "nodes",
    title: "Fielddata evictions",
    description:
      "Warns when fielddata evictions are non-zero, indicating the fielddata cache is under pressure.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/circuit-breaker-settings",
    recommendation:
      "Fielddata evictions mean the cache is too small or text fields are being aggregated. Use keyword fields for aggregations.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      let totalEvictions = 0;
      for (const node of nodes) {
        totalEvictions += node.indices?.fielddata?.evictions ?? 0;
      }
      if (totalEvictions > 0) {
        return {
          status: "warn",
          summary: `${totalEvictions} fielddata eviction${totalEvictions === 1 ? "" : "s"} across cluster.`,
          observed: { totalEvictions },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No fielddata evictions." };
    },
  },
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
      "High query cache evictions reduce search performance. Consider increasing indices.queries.cache.size or reducing query diversity.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      let totalEvictions = 0;
      let totalCacheCount = 0;
      for (const node of nodes) {
        totalEvictions += node.indices?.query_cache?.evictions ?? 0;
        totalCacheCount += node.indices?.query_cache?.cache_count ?? 0;
      }
      if (totalCacheCount > 100 && totalEvictions / totalCacheCount >= 0.5) {
        return {
          status: "warn",
          summary: `Query cache eviction ratio ${((totalEvictions / totalCacheCount) * 100).toFixed(0)}% (${totalEvictions} evictions / ${totalCacheCount} cached).`,
          observed: { totalEvictions, totalCacheCount },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "Query cache eviction rate is normal." };
    },
  },
  {
    id: "nodes.thread_pool.get.rejected",
    domain: "nodes",
    title: "Get rejections",
    description: "Warns when get thread pool rejections are non-zero — hot path overload.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/thread-pool-settings",
    recommendation:
      "Get rejections indicate document retrieval requests are being dropped. Check for hot-path overload on specific indices.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      let total = 0;
      for (const node of nodes) {
        total += node.thread_pool?.get?.rejected ?? 0;
      }
      if (total > 0) {
        return {
          status: "warn",
          summary: `${total} get thread pool rejection${total === 1 ? "" : "s"}.`,
          observed: { totalGetRejections: total },
          links: [{ label: "Nodes", to: "/nodes" }],
        };
      }
      return { status: "pass", summary: "No get rejections." };
    },
  },
  {
    id: "nodes.indices.indexing.latency.high",
    domain: "nodes",
    title: "Indexing latency",
    description: "Warns when average indexing latency exceeds 20ms per document across any node.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "High indexing latency may indicate slow disks, heavy merges, or complex ingest pipelines. Check merge stats and pipeline performance.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
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
              links: [{ label: "Nodes", to: "/nodes" }],
            };
          }
        }
      }
      return { status: "pass", summary: "Indexing latency is within threshold." };
    },
  },
  {
    id: "nodes.indices.indexing.failed",
    domain: "nodes",
    title: "Indexing failures",
    description: "Warns when index_failed count is non-zero on any node.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "Indexing failures mean documents are being rejected. Check for mapping conflicts, version conflicts, or pipeline errors.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      let totalFailed = 0;
      for (const node of nodes) {
        totalFailed += node.indices?.indexing?.index_failed ?? 0;
      }
      if (totalFailed > 0) {
        return {
          status: "warn",
          summary: `${totalFailed} indexing failure${totalFailed === 1 ? "" : "s"} across cluster.`,
          observed: { totalFailed },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No indexing failures." };
    },
  },
  {
    id: "nodes.indices.merges.throttled",
    domain: "nodes",
    title: "Merge throttling",
    description: "Warns when merge throttle time is non-zero, indicating merges are falling behind indexing.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "Merge throttling slows indexing. Consider reducing indexing rate, increasing merge threads, or using faster storage.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      let totalThrottledMs = 0;
      for (const node of nodes) {
        totalThrottledMs += node.indices?.merges?.total_throttled_time_in_millis ?? 0;
      }
      if (totalThrottledMs > 0) {
        const totalThrottledSec = +(totalThrottledMs / 1000).toFixed(1);
        return {
          status: "warn",
          summary: `${totalThrottledSec}s of merge throttle time across cluster.`,
          observed: { totalThrottledMs, totalThrottledSec },
          links: [{ label: "Nodes", to: "/nodes" }],
        };
      }
      return { status: "pass", summary: "No merge throttling." };
    },
  },
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
      "Large translogs slow recovery and increase memory pressure. Check flush frequency and disk I/O performance.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      for (const node of nodes) {
        const uncommitted = node.indices?.translog?.uncommitted_operations ?? 0;
        if (uncommitted >= 100_000) {
          return {
            status: "warn",
            summary: `${node.name ?? "unknown"} has ${uncommitted.toLocaleString()} uncommitted translog operations.`,
            observed: { node: node.name, uncommittedOps: uncommitted },
            links: [{ label: "Nodes", to: "/nodes" }],
          };
        }
      }
      return { status: "pass", summary: "Translog uncommitted operations are normal." };
    },
  },
  {
    id: "nodes.indices.refresh.latency.high",
    domain: "nodes",
    title: "Refresh latency",
    description: "Warns when average refresh latency exceeds 500ms — near-real-time search may lag.",
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "High refresh latency delays search visibility. Check segment count, merge pressure, and consider increasing refresh_interval.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
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
              links: [{ label: "Nodes", to: "/nodes" }],
            };
          }
        }
      }
      return { status: "pass", summary: "Refresh latency is within threshold." };
    },
  },
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
      "High search latency degrades user experience. Profile slow queries, optimize mappings, and check for resource contention.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
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
              links: [{ label: "Nodes", to: "/nodes" }],
            };
          }
        }
      }
      return { status: "pass", summary: "Search query latency is within threshold." };
    },
  },
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
      "High fetch latency may indicate large result sets or stored fields. Reduce _source size or use source filtering.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
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
              links: [{ label: "Nodes", to: "/nodes" }],
            };
          }
        }
      }
      return { status: "pass", summary: "Search fetch latency is within threshold." };
    },
  },
  {
    id: "nodes.indices.search.open_contexts.high",
    domain: "nodes",
    title: "Open scroll contexts",
    description:
      "Warns when open scroll/search contexts are high — open scrolls consume heap and can cause OOM.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "Open scroll contexts hold resources until closed or timed out. Check for scroll leaks in client applications.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      let totalOpen = 0;
      for (const node of nodes) {
        totalOpen += node.indices?.search?.open_contexts ?? 0;
      }
      if (totalOpen >= 100) {
        return {
          status: "warn",
          summary: `${totalOpen} open scroll/search contexts across cluster.`,
          observed: { totalOpenContexts: totalOpen },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "Open scroll context count is normal." };
    },
  },
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
      "High deleted doc ratios waste resources. Consider force-merging read-only indices to expunge deletes.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
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
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "Deleted document ratio is normal." };
    },
  },
  {
    id: "nodes.indices.segments.memory.high",
    domain: "nodes",
    title: "Segment memory usage",
    description:
      "Warns when segment memory is a large portion of heap on any node — too many segments or too many fields.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "High segment memory reduces available heap. Reduce shard count, force-merge old indices, or reduce field count.",
    evaluate: (snapshot) => {
      const nodes = getEligibleNodes(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      for (const node of nodes) {
        const segMem = node.indices?.segments?.memory_in_bytes ?? 0;
        const heapMax = node.jvm?.mem?.heap_max_in_bytes ?? 0;
        if (heapMax > 0 && segMem / heapMax >= 0.5) {
          const pct = +((segMem / heapMax) * 100).toFixed(1);
          return {
            status: "warn",
            summary: `Segment memory on ${node.name ?? "unknown"} is ${pct}% of heap (${(segMem / 1e9).toFixed(1)} GB).`,
            observed: {
              node: node.name,
              segmentMemGb: +(segMem / 1e9).toFixed(1),
              heapMaxGb: +(heapMax / 1e9).toFixed(1),
              percent: pct,
            },
            links: [{ label: "Nodes", to: "/nodes" }],
          };
        }
      }
      return { status: "pass", summary: "Segment memory usage is within threshold." };
    },
  },
  {
    id: "nodes.breaker.request.tripped",
    domain: "nodes",
    title: "Request circuit breaker trips",
    description:
      "Warns when the request circuit breaker has tripped — large aggregations or heavy queries exceeded memory limits.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/circuit-breaker-settings",
    recommendation:
      "Request breaker trips indicate individual requests using too much memory. Optimize aggregations and reduce cardinality.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      let total = 0;
      for (const node of nodes) {
        total += node.breakers?.request?.tripped ?? 0;
      }
      if (total > 0) {
        return {
          status: "warn",
          summary: `Request circuit breaker tripped ${total} time${total === 1 ? "" : "s"}.`,
          observed: { totalTrips: total },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No request breaker trips." };
    },
  },
  {
    id: "nodes.breaker.inflight.tripped",
    domain: "nodes",
    title: "In-flight requests breaker trips",
    description:
      "Warns when the in-flight requests circuit breaker has tripped — too many concurrent requests consuming memory.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/circuit-breaker-settings",
    recommendation:
      "In-flight breaker trips mean too many concurrent requests. Implement client-side throttling or add nodes.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      let total = 0;
      for (const node of nodes) {
        total += node.breakers?.in_flight_requests?.tripped ?? 0;
      }
      if (total > 0) {
        return {
          status: "warn",
          summary: `In-flight requests breaker tripped ${total} time${total === 1 ? "" : "s"}.`,
          observed: { totalTrips: total },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No in-flight request breaker trips." };
    },
  },
];

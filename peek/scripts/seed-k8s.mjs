/**
 * seed-k8s.mjs
 *
 * Seeds Elasticsearch with synthetic Kubernetes OTel metrics data so the
 * Kubernetes page (clusters, namespaces, workloads, pods tabs) shows real content.
 *
 * Data is indexed directly into data streams that match the patterns the
 * Kubernetes query builder reads from:
 *   metrics-kubernetes.pod-default   → pod CPU/memory/restart metrics
 *   logs-kubernetes.container-default → container log records
 *   traces-generic.otel-default       → spans with k8s.* resource attributes
 *
 * The schema matches OTel semantic conventions as used by the EDOT k8s
 * receiver (k8s.cluster.name, k8s.namespace.name, k8s.pod.name, etc.).
 *
 * Usage:
 *   node scripts/seed-k8s.mjs
 *   node scripts/seed-k8s.mjs --url http://localhost:9200
 *   node scripts/seed-k8s.mjs --url http://localhost:9200 --wait-for-ready
 */

import { Client } from "@elastic/elasticsearch";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    url: process.env.ES_URL ?? "http://localhost:9200",
    waitForReady: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url" && argv[i + 1]) opts.url = argv[++i];
    else if (argv[i] === "--wait-for-ready") opts.waitForReady = true;
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Wait for ES
// ---------------------------------------------------------------------------

async function waitForReady(client, maxWaitMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const info = await client.info();
      if (info.tagline) {
        console.log(`  Elasticsearch ${info.version.number} is ready.`);
        return;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(`Elasticsearch did not become ready within ${maxWaitMs / 1000}s`);
}

// ---------------------------------------------------------------------------
// Synthetic k8s topology
// ---------------------------------------------------------------------------

const CLUSTER = "peek-demo-cluster";
const NAMESPACES = ["default", "kube-system", "monitoring", "app-prod", "app-staging"];

const WORKLOADS = [
  { name: "frontend", kind: "Deployment", namespace: "app-prod", replicas: 3 },
  { name: "api-server", kind: "Deployment", namespace: "app-prod", replicas: 2 },
  { name: "worker", kind: "Deployment", namespace: "app-staging", replicas: 2 },
  { name: "postgres", kind: "StatefulSet", namespace: "app-prod", replicas: 1 },
  { name: "redis", kind: "StatefulSet", namespace: "default", replicas: 1 },
  { name: "grafana", kind: "Deployment", namespace: "monitoring", replicas: 1 },
  { name: "otel-collector", kind: "DaemonSet", namespace: "monitoring", replicas: 2 },
  { name: "coredns", kind: "Deployment", namespace: "kube-system", replicas: 2 },
];

const NODES = ["node-1", "node-2", "node-3"];

/**
 * Expand workloads into pod rows, assigning each replica a pod name and node.
 */
function buildPods() {
  const pods = [];
  for (const w of WORKLOADS) {
    for (let i = 0; i < w.replicas; i++) {
      const suffix = Math.random().toString(36).slice(2, 7);
      pods.push({
        podName: `${w.name}-${suffix}`,
        workloadName: w.name,
        workloadKind: w.kind,
        namespace: w.namespace,
        node: NODES[pods.length % NODES.length],
        containerName: w.name,
        cpuUtil: Math.random() * 0.8 + 0.05,        // 5–85%
        memoryBytes: Math.floor(Math.random() * 500_000_000 + 50_000_000), // 50–550MB
        restarts: Math.floor(Math.random() * 3),
      });
    }
  }
  return pods;
}

// ---------------------------------------------------------------------------
// Bulk helpers
// ---------------------------------------------------------------------------

async function bulkIndex(client, index, docs) {
  if (docs.length === 0) return;
  const operations = docs.flatMap((doc) => [{ create: { _index: index } }, doc]);
  const resp = await client.bulk({ operations, refresh: true });
  if (resp.errors) {
    const failed = resp.items.filter((i) => i.create?.error);
    const firstError = failed[0]?.create?.error;
    throw new Error(
      `Bulk indexing failed for ${failed.length}/${docs.length} docs in ${index}: ` +
        `${JSON.stringify(firstError)}`,
    );
  }
  console.log(`  Indexed ${docs.length} docs into ${index}`);
}

// ---------------------------------------------------------------------------
// Seed: pod metrics  (metrics-kubernetes.pod-default)
// ---------------------------------------------------------------------------

async function seedPodMetrics(client, pods) {
  const now = Date.now();
  const docs = [];

  for (const pod of pods) {
    // One metric document per pod every 5 minutes for the last hour
    for (let minutesAgo = 0; minutesAgo <= 60; minutesAgo += 5) {
      docs.push({
        "@timestamp": new Date(now - minutesAgo * 60_000).toISOString(),
        "k8s.cluster.name": CLUSTER,
        "k8s.namespace.name": pod.namespace,
        "k8s.pod.name": pod.podName,
        "k8s.node.name": pod.node,
        "k8s.container.name": pod.containerName,
        "k8s.deployment.name": pod.workloadKind === "Deployment" ? pod.workloadName : undefined,
        "k8s.statefulset.name":
          pod.workloadKind === "StatefulSet" ? pod.workloadName : undefined,
        "k8s.daemonset.name": pod.workloadKind === "DaemonSet" ? pod.workloadName : undefined,
        // CPU utilization as a fraction (0–1)
        "k8s.pod.cpu.utilization": pod.cpuUtil + (Math.random() - 0.5) * 0.1,
        // Memory usage in bytes
        "k8s.pod.memory.usage": pod.memoryBytes + Math.floor((Math.random() - 0.5) * 10_000_000),
        // Restart count stays stable
        "k8s.container.restarts": pod.restarts,
        "service.name": pod.workloadName,
        "data_stream.type": "metrics",
        "data_stream.dataset": "kubernetes.pod",
        "data_stream.namespace": "default",
      });
    }
  }

  await bulkIndex(client, "metrics-kubernetes.pod-default", docs);
}

// ---------------------------------------------------------------------------
// Seed: container logs  (logs-kubernetes.container-default)
// ---------------------------------------------------------------------------

const LOG_MESSAGES = [
  "Server started on :8080",
  "Connected to database",
  "GET /health 200 2ms",
  "GET /api/users 200 14ms",
  "POST /api/orders 201 45ms",
  "Cache miss — fetching from DB",
  "Retrying failed request (attempt 2/3)",
  "Warning: high memory pressure detected",
  "Error: connection timeout after 30s",
  "Pod ready",
];

async function seedContainerLogs(client, pods) {
  const now = Date.now();
  const docs = [];

  for (const pod of pods) {
    for (let i = 0; i < 20; i++) {
      const msg = LOG_MESSAGES[i % LOG_MESSAGES.length];
      const severity = msg.startsWith("Error") ? "ERROR" : msg.startsWith("Warning") ? "WARN" : "INFO";
      docs.push({
        "@timestamp": new Date(now - i * 3 * 60_000).toISOString(),
        "k8s.cluster.name": CLUSTER,
        "k8s.namespace.name": pod.namespace,
        "k8s.pod.name": pod.podName,
        "k8s.node.name": pod.node,
        "k8s.container.name": pod.containerName,
        "service.name": pod.workloadName,
        message: msg,
        "log.level": severity,
        "severity.text": severity,
        "data_stream.type": "logs",
        "data_stream.dataset": "kubernetes.container",
        "data_stream.namespace": "default",
      });
    }
  }

  await bulkIndex(client, "logs-kubernetes.container-default", docs);
}

// ---------------------------------------------------------------------------
// Seed: traces with k8s resource attributes  (traces-generic.otel-default)
// ---------------------------------------------------------------------------

function randomHex(len) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

const K8S_SERVICE_META = {
  frontend: { language: "javascript", version: "2.4.1" },
  "api-server": { language: "go", version: "1.8.0" },
  worker: { language: "python", version: "1.2.0" },
};

async function seedK8sTraces(client, pods) {
  const now = Date.now();
  const docs = [];
  const servicePods = pods.filter((p) => ["frontend", "api-server", "worker"].includes(p.workloadName));

  for (const pod of servicePods) {
    const meta = K8S_SERVICE_META[pod.workloadName] ?? { language: "unknown", version: "0.0.0" };
    const env = pod.namespace === "app-prod" ? "production" : "staging";

    for (let i = 0; i < 15; i++) {
      const traceId = randomHex(32);
      const startMs = now - i * 4 * 60_000;
      const isError = Math.random() < 0.05;
      const durationNs = Math.floor(Math.random() * 200 + 5) * 1_000_000;
      docs.push({
        "@timestamp": new Date(startMs).toISOString(),
        "trace.id": traceId,
        "span.id": randomHex(16),
        name: `GET /api/${pod.workloadName}`,
        kind: "SERVER",
        duration: durationNs,
        "attributes.span.duration.us": Math.floor(durationNs / 1000),
        "parent.id": null,
        "status.code": isError ? "Error" : "OK",
        "service.name": pod.workloadName,
        "service.version": meta.version,
        "service.language.name": meta.language,
        "service.environment": env,
        "deployment.environment": env,
        "attributes.http.route": `/api/${pod.workloadName}`,
        "http.status_code": isError ? 500 : 200,
        "k8s.cluster.name": CLUSTER,
        "k8s.namespace.name": pod.namespace,
        "k8s.pod.name": pod.podName,
        "k8s.node.name": pod.node,
        "data_stream.type": "traces",
        "data_stream.dataset": "generic.otel",
        "data_stream.namespace": "default",
      });
    }
  }

  await bulkIndex(client, "traces-generic.otel-default", docs);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2));
const client = new Client({ node: opts.url });

if (opts.waitForReady) {
  console.log("Waiting for Elasticsearch to be ready...");
  await waitForReady(client);
}

const pods = buildPods();
console.log(`Seeding Kubernetes data for cluster "${CLUSTER}"...`);
console.log(`  ${pods.length} pods across ${NAMESPACES.length} namespaces on ${NODES.length} nodes`);

await seedPodMetrics(client, pods);
await seedContainerLogs(client, pods);
await seedK8sTraces(client, pods);

console.log("✓ Kubernetes seed data indexed.");

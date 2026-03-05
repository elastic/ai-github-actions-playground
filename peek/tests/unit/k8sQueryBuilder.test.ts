import { describe, it, expect } from "vitest";

import type { K8sFieldMapping } from "../../src/components/kubernetes/k8sQueryBuilder";
import {
  DEFAULT_K8S_FIELD_MAPPING,
  buildClusterInventoryQuery,
  buildNamespaceInventoryQuery,
  buildWorkloadInventoryQuery,
  buildAllWorkloadsInventoryQuery,
  buildPodInventoryQuery,
  buildPodDetailQuery,
  buildK8sLogsQuery,
  buildK8sTracesQuery,
} from "../../src/components/kubernetes/k8sQueryBuilder";
import {
  parseClusterInventory,
  parseNamespaceInventory,
  parseWorkloadInventory,
  parsePodInventory,
  parsePodDetail,
  extractServiceNames,
} from "../../src/components/kubernetes/k8sHelpers";

const DEFAULT_FILTERS = { timeFrom: "NOW() - 1 hour", timeTo: "NOW()" };

describe("k8sQueryBuilder", () => {
  describe("DEFAULT_K8S_FIELD_MAPPING", () => {
    it("has expected index patterns", () => {
      expect(DEFAULT_K8S_FIELD_MAPPING.metricsIndex).toBe("metrics-*");
      expect(DEFAULT_K8S_FIELD_MAPPING.logsIndex).toBe("logs-*");
      expect(DEFAULT_K8S_FIELD_MAPPING.tracesIndex).toBe("traces-*");
    });

    it("uses OTel semantic convention field names", () => {
      expect(DEFAULT_K8S_FIELD_MAPPING.podName).toBe("k8s.pod.name");
      expect(DEFAULT_K8S_FIELD_MAPPING.namespace).toBe("k8s.namespace.name");
      expect(DEFAULT_K8S_FIELD_MAPPING.clusterName).toBe("k8s.cluster.name");
      expect(DEFAULT_K8S_FIELD_MAPPING.nodeName).toBe("k8s.node.name");
    });
  });

  describe("buildClusterInventoryQuery", () => {
    it("generates a valid ES|QL query with default filters", () => {
      const query = buildClusterInventoryQuery(DEFAULT_FILTERS);
      expect(query).toContain("FROM metrics-*");
      expect(query).toContain("@timestamp >= NOW() - 1 hour");
      expect(query).toContain("@timestamp <= NOW()");
      expect(query).toContain("k8s.pod.name IS NOT NULL");
      expect(query).toContain("pod_count = COUNT_DISTINCT(k8s.pod.name)");
      expect(query).toContain("avg_cpu = AVG(k8s.pod.cpu.utilization)");
      expect(query).toContain("avg_memory = AVG(k8s.pod.memory.usage)");
      expect(query).toContain("namespace_count = COUNT_DISTINCT(k8s.namespace.name)");
      expect(query).toContain("node_count = COUNT_DISTINCT(k8s.node.name)");
      expect(query).toContain("BY cluster_name = k8s.cluster.name");
      expect(query).toContain("SORT pod_count DESC");
      expect(query).toContain("LIMIT 100");
    });

    it("includes cluster filter when provided", () => {
      const query = buildClusterInventoryQuery({
        ...DEFAULT_FILTERS,
        cluster: "prod-cluster",
      });
      expect(query).toContain('k8s.cluster.name == "prod-cluster"');
    });

    it("escapes special characters in cluster name", () => {
      const query = buildClusterInventoryQuery({
        ...DEFAULT_FILTERS,
        cluster: 'my "cluster"',
      });
      expect(query).toContain('k8s.cluster.name == "my \\"cluster\\""');
    });

    it("throws for unsupported time expressions", () => {
      expect(() =>
        buildClusterInventoryQuery({
          timeFrom: "NOW() - 1 hour",
          timeTo: "NOW(); DROP TABLE metrics",
        }),
      ).toThrow("Unsupported time expression");
    });
  });

  describe("buildNamespaceInventoryQuery", () => {
    it("generates a valid ES|QL query", () => {
      const query = buildNamespaceInventoryQuery(DEFAULT_FILTERS);
      expect(query).toContain("FROM metrics-*");
      expect(query).toContain("pod_count = COUNT_DISTINCT(k8s.pod.name)");
      expect(query).toContain("cluster_name = k8s.cluster.name");
      expect(query).toContain("namespace_name = k8s.namespace.name");
      expect(query).toContain("LIMIT 200");
    });

    it("includes cluster and namespace filters", () => {
      const query = buildNamespaceInventoryQuery({
        ...DEFAULT_FILTERS,
        cluster: "prod",
        namespace: "kube-system",
      });
      expect(query).toContain('k8s.cluster.name == "prod"');
      expect(query).toContain('k8s.namespace.name == "kube-system"');
    });
  });

  describe("buildWorkloadInventoryQuery", () => {
    it("generates a query for deployments", () => {
      const query = buildWorkloadInventoryQuery("deployment", DEFAULT_FILTERS);
      expect(query).toContain("FROM metrics-*");
      expect(query).toContain("k8s.deployment.name IS NOT NULL");
      expect(query).toContain('workload_kind = "deployment"');
      expect(query).toContain("workload_name = k8s.deployment.name");
    });

    it("generates a query for statefulsets", () => {
      const query = buildWorkloadInventoryQuery("statefulset", DEFAULT_FILTERS);
      expect(query).toContain("k8s.statefulset.name IS NOT NULL");
      expect(query).toContain('workload_kind = "statefulset"');
      expect(query).toContain("workload_name = k8s.statefulset.name");
    });

    it("generates a query for daemonsets", () => {
      const query = buildWorkloadInventoryQuery("daemonset", DEFAULT_FILTERS);
      expect(query).toContain("k8s.daemonset.name IS NOT NULL");
      expect(query).toContain('workload_kind = "daemonset"');
      expect(query).toContain("workload_name = k8s.daemonset.name");
    });

    it("generates a query for jobs", () => {
      const query = buildWorkloadInventoryQuery("job", DEFAULT_FILTERS);
      expect(query).toContain("k8s.job.name IS NOT NULL");
      expect(query).toContain('workload_kind = "job"');
      expect(query).toContain("workload_name = k8s.job.name");
    });

    it("generates a query for cronjobs", () => {
      const query = buildWorkloadInventoryQuery("cronjob", DEFAULT_FILTERS);
      expect(query).toContain("k8s.cronjob.name IS NOT NULL");
      expect(query).toContain('workload_kind = "cronjob"');
      expect(query).toContain("workload_name = k8s.cronjob.name");
    });

    it("generates a query for replicasets", () => {
      const query = buildWorkloadInventoryQuery("replicaset", DEFAULT_FILTERS);
      expect(query).toContain("k8s.replicaset.name IS NOT NULL");
      expect(query).toContain('workload_kind = "replicaset"');
      expect(query).toContain("workload_name = k8s.replicaset.name");
    });
  });

  describe("buildAllWorkloadsInventoryQuery", () => {
    it("generates a query that includes all supported workload kinds", () => {
      const query = buildAllWorkloadsInventoryQuery(DEFAULT_FILTERS);
      expect(query).toContain("k8s.deployment.name IS NOT NULL");
      expect(query).toContain("k8s.replicaset.name IS NOT NULL");
      expect(query).toContain("k8s.statefulset.name IS NOT NULL");
      expect(query).toContain("k8s.daemonset.name IS NOT NULL");
      expect(query).toContain("k8s.job.name IS NOT NULL");
      expect(query).toContain("k8s.cronjob.name IS NOT NULL");
      expect(query).toContain("BY cluster_name = k8s.cluster.name");
      expect(query).toContain("namespace_name = k8s.namespace.name");
      expect(query).toContain("workload_kind = CASE");
      expect(query).toContain('k8s.deployment.name IS NOT NULL, "deployment"');
      expect(query).toContain('k8s.replicaset.name IS NOT NULL, "replicaset"');
      expect(query).toContain('k8s.statefulset.name IS NOT NULL, "statefulset"');
      expect(query).toContain('k8s.daemonset.name IS NOT NULL, "daemonset"');
      expect(query).toContain('k8s.job.name IS NOT NULL, "job"');
      expect(query).toContain('k8s.cronjob.name IS NOT NULL, "cronjob"');
      expect(query).toContain("workload_name = COALESCE(");
      expect(query).toContain("k8s.deployment.name");
      expect(query).toContain("k8s.replicaset.name");
      expect(query).toContain("k8s.statefulset.name");
      expect(query).toContain("k8s.daemonset.name");
      expect(query).toContain("k8s.job.name");
      expect(query).toContain("k8s.cronjob.name");
    });

    it("includes cluster and namespace filters when provided", () => {
      const query = buildAllWorkloadsInventoryQuery({
        ...DEFAULT_FILTERS,
        cluster: "prod",
        namespace: "kube-system",
      });
      expect(query).toContain('k8s.cluster.name == "prod"');
      expect(query).toContain('k8s.namespace.name == "kube-system"');
    });
  });

  describe("buildPodInventoryQuery", () => {
    it("generates a valid ES|QL query", () => {
      const query = buildPodInventoryQuery(DEFAULT_FILTERS);
      expect(query).toContain("FROM metrics-*");
      expect(query).toContain("k8s.pod.name IS NOT NULL");
      expect(query).toContain("avg_cpu = AVG(k8s.pod.cpu.utilization)");
      expect(query).toContain("restarts = SUM(k8s.container.restarts)");
      expect(query).toContain(
        "cluster_name = k8s.cluster.name, pod_name = k8s.pod.name, namespace_name = k8s.namespace.name, node_name = k8s.node.name",
      );
      expect(query).toContain("SORT avg_cpu DESC");
      expect(query).toContain("LIMIT 500");
    });

    it("includes namespace filter", () => {
      const query = buildPodInventoryQuery({
        ...DEFAULT_FILTERS,
        namespace: "default",
      });
      expect(query).toContain('k8s.namespace.name == "default"');
    });
  });

  describe("buildPodDetailQuery", () => {
    it("generates a query for a specific pod", () => {
      const query = buildPodDetailQuery("my-pod-abc123", DEFAULT_FILTERS);
      expect(query).toContain("FROM metrics-*");
      expect(query).toContain('k8s.pod.name == "my-pod-abc123"');
      expect(query).toContain(
        "BY pod_name = k8s.pod.name, namespace_name = k8s.namespace.name, node_name = k8s.node.name, container_name = k8s.container.name",
      );
      expect(query).toContain("SORT container_name");
      expect(query).toContain("LIMIT 100");
    });

    it("escapes special characters in pod name", () => {
      const query = buildPodDetailQuery('pod-"special"', DEFAULT_FILTERS);
      expect(query).toContain('k8s.pod.name == "pod-\\"special\\""');
    });
  });

  describe("buildK8sLogsQuery", () => {
    it("generates a logs query with time filter", () => {
      const query = buildK8sLogsQuery(DEFAULT_FILTERS);
      expect(query).toContain("FROM logs-*");
      expect(query).toContain("SORT @timestamp DESC");
      expect(query).toContain(
        "KEEP @timestamp, k8s.pod.name, k8s.namespace.name, k8s.container.name, message",
      );
      expect(query).toContain("LIMIT 500");
    });

    it("includes pod name filter when provided", () => {
      const query = buildK8sLogsQuery({ ...DEFAULT_FILTERS, podName: "my-pod" });
      expect(query).toContain('k8s.pod.name == "my-pod"');
    });

    it("includes cluster filter when provided", () => {
      const query = buildK8sLogsQuery({ ...DEFAULT_FILTERS, cluster: "prod" });
      expect(query).toContain('k8s.cluster.name == "prod"');
    });
  });

  describe("buildK8sTracesQuery", () => {
    it("generates a traces query with time filter", () => {
      const query = buildK8sTracesQuery(DEFAULT_FILTERS);
      expect(query).toContain("FROM traces-*");
      expect(query).toContain("SORT @timestamp DESC");
      expect(query).toContain(
        "KEEP @timestamp, service.name, k8s.pod.name, k8s.namespace.name, name, trace.id, span.id",
      );
      expect(query).toContain("LIMIT 500");
    });

    it("includes pod name filter when provided", () => {
      const query = buildK8sTracesQuery({ ...DEFAULT_FILTERS, podName: "my-pod" });
      expect(query).toContain('k8s.pod.name == "my-pod"');
    });

    it("includes namespace filter when provided", () => {
      const query = buildK8sTracesQuery({ ...DEFAULT_FILTERS, namespace: "production" });
      expect(query).toContain('k8s.namespace.name == "production"');
    });
  });
});

describe("k8sHelpers", () => {
  describe("parseClusterInventory", () => {
    it("parses cluster inventory response", () => {
      const result = parseClusterInventory({
        columns: [
          { name: "pod_count", type: "long" },
          { name: "avg_cpu", type: "double" },
          { name: "avg_memory", type: "long" },
          { name: "namespace_count", type: "long" },
          { name: "node_count", type: "long" },
          { name: "cluster_name", type: "keyword" },
        ],
        values: [
          [42, 0.75, 1073741824, 5, 3, "prod-cluster"],
          [10, null, null, 2, 1, "staging"],
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        clusterName: "prod-cluster",
        podCount: 42,
        avgCpu: 0.75,
        avgMemory: 1073741824,
        namespaceCount: 5,
        nodeCount: 3,
      });
      expect(result[1]!.avgCpu).toBeNull();
      expect(result[1]!.avgMemory).toBeNull();
    });

    it("returns empty array for empty response", () => {
      const result = parseClusterInventory({
        columns: [
          { name: "pod_count", type: "long" },
          { name: "avg_cpu", type: "double" },
          { name: "avg_memory", type: "long" },
          { name: "namespace_count", type: "long" },
          { name: "node_count", type: "long" },
          { name: "cluster_name", type: "keyword" },
        ],
        values: [],
      });
      expect(result).toEqual([]);
    });
  });

  describe("parseNamespaceInventory", () => {
    it("parses namespace inventory response", () => {
      const result = parseNamespaceInventory({
        columns: [
          { name: "pod_count", type: "long" },
          { name: "avg_cpu", type: "double" },
          { name: "avg_memory", type: "long" },
          { name: "cluster_name", type: "keyword" },
          { name: "namespace_name", type: "keyword" },
        ],
        values: [
          [20, 0.5, 536870912, "prod-cluster", "kube-system"],
          [15, 0.3, 268435456, "prod-cluster", "default"],
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        clusterName: "prod-cluster",
        namespace: "kube-system",
        podCount: 20,
        avgCpu: 0.5,
        avgMemory: 536870912,
      });
    });
  });

  describe("parseWorkloadInventory", () => {
    it("parses workload inventory response", () => {
      const result = parseWorkloadInventory({
        columns: [
          { name: "pod_count", type: "long" },
          { name: "avg_cpu", type: "double" },
          { name: "avg_memory", type: "long" },
          { name: "cluster_name", type: "keyword" },
          { name: "namespace_name", type: "keyword" },
          { name: "workload_kind", type: "keyword" },
          { name: "workload_name", type: "keyword" },
        ],
        values: [
          [3, 0.4, 524288000, "prod-cluster", "default", "deployment", "nginx-deploy"],
          [2, 0.2, 262144000, "prod-cluster", "default", "statefulset", "redis-deploy"],
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        clusterName: "prod-cluster",
        namespace: "default",
        workloadName: "nginx-deploy",
        workloadKind: "deployment",
        podCount: 3,
        avgCpu: 0.4,
        avgMemory: 524288000,
      });
    });
  });

  describe("parsePodInventory", () => {
    it("parses pod inventory response", () => {
      const result = parsePodInventory({
        columns: [
          { name: "avg_cpu", type: "double" },
          { name: "avg_memory", type: "long" },
          { name: "restarts", type: "long" },
          { name: "cluster_name", type: "keyword" },
          { name: "pod_name", type: "keyword" },
          { name: "namespace_name", type: "keyword" },
          { name: "node_name", type: "keyword" },
        ],
        values: [[0.6, 512000000, 2, "prod-cluster", "web-abc123", "default", "node-1"]],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        clusterName: "prod-cluster",
        podName: "web-abc123",
        namespace: "default",
        nodeName: "node-1",
        avgCpu: 0.6,
        avgMemory: 512000000,
        restarts: 2,
      });
    });
  });

  describe("parsePodDetail", () => {
    it("parses pod detail response with container breakdown", () => {
      const result = parsePodDetail({
        columns: [
          { name: "avg_cpu", type: "double" },
          { name: "avg_memory", type: "long" },
          { name: "restarts", type: "long" },
          { name: "pod_name", type: "keyword" },
          { name: "namespace_name", type: "keyword" },
          { name: "node_name", type: "keyword" },
          { name: "container_name", type: "keyword" },
        ],
        values: [
          [0.3, 256000000, 0, "web-abc123", "default", "node-1", "nginx"],
          [0.2, 128000000, 1, "web-abc123", "default", "node-1", "sidecar"],
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0]!.containerName).toBe("nginx");
      expect(result[1]!.containerName).toBe("sidecar");
      expect(result[1]!.restarts).toBe(1);
    });
  });

  describe("extractServiceNames", () => {
    it("extracts unique sorted service names from traces response", () => {
      const result = extractServiceNames({
        columns: [
          { name: "@timestamp", type: "date" },
          { name: "service.name", type: "keyword" },
          { name: "k8s.pod.name", type: "keyword" },
          { name: "k8s.namespace.name", type: "keyword" },
          { name: "name", type: "keyword" },
          { name: "trace.id", type: "keyword" },
          { name: "span.id", type: "keyword" },
        ],
        values: [
          ["2024-01-01T00:00:00Z", "frontend", "pod-1", "default", "GET /", "t1", "s1"],
          ["2024-01-01T00:00:01Z", "backend", "pod-2", "default", "POST /api", "t2", "s2"],
          ["2024-01-01T00:00:02Z", "frontend", "pod-1", "default", "GET /home", "t3", "s3"],
        ],
      });

      expect(result).toEqual(["backend", "frontend"]);
    });

    it("returns empty array when service.name column is missing", () => {
      const result = extractServiceNames({
        columns: [
          { name: "@timestamp", type: "date" },
          { name: "name", type: "keyword" },
        ],
        values: [["2024-01-01T00:00:00Z", "GET /"]],
      });
      expect(result).toEqual([]);
    });

    it("skips null and empty service names", () => {
      const result = extractServiceNames({
        columns: [
          { name: "service.name", type: "keyword" },
          { name: "name", type: "keyword" },
        ],
        values: [
          [null, "GET /"],
          ["", "POST /api"],
          ["  ", "DELETE /items"],
          ["my-service", "PUT /items"],
        ],
      });
      expect(result).toEqual(["my-service"]);
    });

    it("returns empty array for empty values", () => {
      const result = extractServiceNames({
        columns: [{ name: "service.name", type: "keyword" }],
        values: [],
      });
      expect(result).toEqual([]);
    });
  });
});

describe("custom K8sFieldMapping", () => {
  const CUSTOM_MAPPING: K8sFieldMapping = {
    ...DEFAULT_K8S_FIELD_MAPPING,
    metricsIndex: "custom-metrics-*",
    clusterName: "custom.cluster",
    namespace: "custom.namespace",
    podName: "custom.pod",
    nodeName: "custom.node",
    containerName: "custom.container",
    cpuUsage: "custom.cpu",
    memoryUsage: "custom.memory",
    restartCount: "custom.restarts",
  };

  it("queries custom field names while keeping fixed output aliases", () => {
    const query = buildClusterInventoryQuery(DEFAULT_FILTERS, CUSTOM_MAPPING);
    // Custom field names appear in expressions
    expect(query).toContain("FROM custom-metrics-*");
    expect(query).toContain("COUNT_DISTINCT(custom.pod)");
    expect(query).toContain("AVG(custom.cpu)");
    // Output aliases are fixed regardless of field mapping
    expect(query).toContain("BY cluster_name = custom.cluster");
    expect(query).not.toContain("BY custom.cluster");
  });

  it("pod inventory query uses fixed BY aliases with custom fields", () => {
    const query = buildPodInventoryQuery(DEFAULT_FILTERS, CUSTOM_MAPPING);
    expect(query).toContain("AVG(custom.cpu)");
    expect(query).toContain(
      "cluster_name = custom.cluster, pod_name = custom.pod, namespace_name = custom.namespace, node_name = custom.node",
    );
  });

  it("pod detail query uses fixed BY aliases and SORT alias with custom fields", () => {
    const query = buildPodDetailQuery("my-pod", DEFAULT_FILTERS, CUSTOM_MAPPING);
    expect(query).toContain(
      "BY pod_name = custom.pod, namespace_name = custom.namespace, node_name = custom.node, container_name = custom.container",
    );
    expect(query).toContain("SORT container_name");
    expect(query).not.toContain("SORT custom.container");
  });

  it("parsers correctly handle responses with fixed alias columns from custom-mapped queries", () => {
    // Simulate the response ES|QL would return when aliases are used: column names
    // are the alias names, not the underlying custom field names.
    const clusterResult = parseClusterInventory({
      columns: [
        { name: "pod_count", type: "long" },
        { name: "avg_cpu", type: "double" },
        { name: "avg_memory", type: "long" },
        { name: "namespace_count", type: "long" },
        { name: "node_count", type: "long" },
        { name: "cluster_name", type: "keyword" },
      ],
      values: [[5, 0.2, 1024, 2, 1, "custom-cluster"]],
    });
    expect(clusterResult[0]!.clusterName).toBe("custom-cluster");

    const podResult = parsePodInventory({
      columns: [
        { name: "avg_cpu", type: "double" },
        { name: "avg_memory", type: "long" },
        { name: "restarts", type: "long" },
        { name: "cluster_name", type: "keyword" },
        { name: "pod_name", type: "keyword" },
        { name: "namespace_name", type: "keyword" },
        { name: "node_name", type: "keyword" },
      ],
      values: [[0.1, 512, 0, "custom-cluster", "custom-pod", "custom-ns", "custom-node"]],
    });
    expect(podResult[0]!.podName).toBe("custom-pod");
    expect(podResult[0]!.clusterName).toBe("custom-cluster");
    expect(podResult[0]!.namespace).toBe("custom-ns");
  });
});

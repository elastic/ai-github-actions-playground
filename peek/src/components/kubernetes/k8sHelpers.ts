/**
 * Typed row models and ES|QL response parsers for Kubernetes observability pages.
 */

// ---------------------------------------------------------------------------
// ES|QL response shape (shared with other parsers in the codebase)
// ---------------------------------------------------------------------------

export interface EsqlColumn {
  name: string;
  type: string;
}

export interface EsqlResponse {
  columns: EsqlColumn[];
  values: unknown[][];
}

// ---------------------------------------------------------------------------
// Row models
// ---------------------------------------------------------------------------

export interface ClusterRow {
  clusterName: string;
  podCount: number;
  avgCpu: number | null;
  avgMemory: number | null;
  namespaceCount: number;
  nodeCount: number;
}

export interface NamespaceRow {
  namespace: string;
  podCount: number;
  avgCpu: number | null;
  avgMemory: number | null;
}

export interface WorkloadRow {
  workloadName: string;
  podCount: number;
  avgCpu: number | null;
  avgMemory: number | null;
}

export interface PodRow {
  podName: string;
  namespace: string;
  nodeName: string;
  avgCpu: number | null;
  avgMemory: number | null;
  restarts: number;
}

export interface PodDetailRow {
  podName: string;
  namespace: string;
  nodeName: string;
  containerName: string;
  avgCpu: number | null;
  avgMemory: number | null;
  restarts: number;
}

// ---------------------------------------------------------------------------
// Column index resolver
// ---------------------------------------------------------------------------

function columnIndex(columns: EsqlColumn[], name: string): number {
  const idx = columns.findIndex((c) => c.name === name);
  if (idx === -1) throw new Error(`Column "${name}" not found in response`);
  return idx;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseClusterInventory(response: EsqlResponse): ClusterRow[] {
  const cols = response.columns;
  const iCluster = columnIndex(cols, "k8s.cluster.name");
  const iPodCount = columnIndex(cols, "pod_count");
  const iAvgCpu = columnIndex(cols, "avg_cpu");
  const iAvgMemory = columnIndex(cols, "avg_memory");
  const iNamespaceCount = columnIndex(cols, "namespace_count");
  const iNodeCount = columnIndex(cols, "node_count");

  return response.values.map((row) => ({
    clusterName: String(row[iCluster] ?? ""),
    podCount: Number(row[iPodCount] ?? 0),
    avgCpu: row[iAvgCpu] != null ? Number(row[iAvgCpu]) : null,
    avgMemory: row[iAvgMemory] != null ? Number(row[iAvgMemory]) : null,
    namespaceCount: Number(row[iNamespaceCount] ?? 0),
    nodeCount: Number(row[iNodeCount] ?? 0),
  }));
}

export function parseNamespaceInventory(response: EsqlResponse): NamespaceRow[] {
  const cols = response.columns;
  const iNamespace = columnIndex(cols, "k8s.namespace.name");
  const iPodCount = columnIndex(cols, "pod_count");
  const iAvgCpu = columnIndex(cols, "avg_cpu");
  const iAvgMemory = columnIndex(cols, "avg_memory");

  return response.values.map((row) => ({
    namespace: String(row[iNamespace] ?? ""),
    podCount: Number(row[iPodCount] ?? 0),
    avgCpu: row[iAvgCpu] != null ? Number(row[iAvgCpu]) : null,
    avgMemory: row[iAvgMemory] != null ? Number(row[iAvgMemory]) : null,
  }));
}

export function parseWorkloadInventory(response: EsqlResponse): WorkloadRow[] {
  const cols = response.columns;
  // The workload name column varies by kind; it's always the last column in the STATS BY clause.
  const nameColIndex = cols.length - 1;
  const iPodCount = columnIndex(cols, "pod_count");
  const iAvgCpu = columnIndex(cols, "avg_cpu");
  const iAvgMemory = columnIndex(cols, "avg_memory");

  return response.values.map((row) => ({
    workloadName: String(row[nameColIndex] ?? ""),
    podCount: Number(row[iPodCount] ?? 0),
    avgCpu: row[iAvgCpu] != null ? Number(row[iAvgCpu]) : null,
    avgMemory: row[iAvgMemory] != null ? Number(row[iAvgMemory]) : null,
  }));
}

export function parsePodInventory(response: EsqlResponse): PodRow[] {
  const cols = response.columns;
  const iPodName = columnIndex(cols, "k8s.pod.name");
  const iNamespace = columnIndex(cols, "k8s.namespace.name");
  const iNodeName = columnIndex(cols, "k8s.node.name");
  const iAvgCpu = columnIndex(cols, "avg_cpu");
  const iAvgMemory = columnIndex(cols, "avg_memory");
  const iRestarts = columnIndex(cols, "restarts");

  return response.values.map((row) => ({
    podName: String(row[iPodName] ?? ""),
    namespace: String(row[iNamespace] ?? ""),
    nodeName: String(row[iNodeName] ?? ""),
    avgCpu: row[iAvgCpu] != null ? Number(row[iAvgCpu]) : null,
    avgMemory: row[iAvgMemory] != null ? Number(row[iAvgMemory]) : null,
    restarts: Number(row[iRestarts] ?? 0),
  }));
}

export function parsePodDetail(response: EsqlResponse): PodDetailRow[] {
  const cols = response.columns;
  const iPodName = columnIndex(cols, "k8s.pod.name");
  const iNamespace = columnIndex(cols, "k8s.namespace.name");
  const iNodeName = columnIndex(cols, "k8s.node.name");
  const iContainerName = columnIndex(cols, "k8s.container.name");
  const iAvgCpu = columnIndex(cols, "avg_cpu");
  const iAvgMemory = columnIndex(cols, "avg_memory");
  const iRestarts = columnIndex(cols, "restarts");

  return response.values.map((row) => ({
    podName: String(row[iPodName] ?? ""),
    namespace: String(row[iNamespace] ?? ""),
    nodeName: String(row[iNodeName] ?? ""),
    containerName: String(row[iContainerName] ?? ""),
    avgCpu: row[iAvgCpu] != null ? Number(row[iAvgCpu]) : null,
    avgMemory: row[iAvgMemory] != null ? Number(row[iAvgMemory]) : null,
    restarts: Number(row[iRestarts] ?? 0),
  }));
}

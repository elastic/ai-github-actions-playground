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
  workloadKind: string;
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

export function formatCpu(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatMemory(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GiB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
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
// Service names extractor (for cross-linking K8s → Services)
// ---------------------------------------------------------------------------

/**
 * Extracts unique non-empty service names from a K8s traces ES|QL response.
 * Returns a sorted array of distinct service names, or an empty array when
 * the column is missing (graceful degradation).
 */
export function extractServiceNames(response: EsqlResponse): string[] {
  const idx = response.columns.findIndex((c) => c.name === "service.name");
  if (idx === -1) return [];
  const names = new Set<string>();
  for (const row of response.values) {
    const value = row[idx];
    if (value != null && String(value).trim().length > 0) {
      names.add(String(value).trim());
    }
  }
  return Array.from(names).sort();
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseClusterInventory(response: EsqlResponse): ClusterRow[] {
  const cols = response.columns;
  const iCluster = columnIndex(cols, "cluster_name");
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
  const iNamespace = columnIndex(cols, "namespace_name");
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
  const iWorkloadName = columnIndex(cols, "workload_name");
  const iWorkloadKind = columnIndex(cols, "workload_kind");
  const iPodCount = columnIndex(cols, "pod_count");
  const iAvgCpu = columnIndex(cols, "avg_cpu");
  const iAvgMemory = columnIndex(cols, "avg_memory");

  return response.values.map((row) => ({
    workloadName: String(row[iWorkloadName] ?? ""),
    workloadKind: String(row[iWorkloadKind] ?? ""),
    podCount: Number(row[iPodCount] ?? 0),
    avgCpu: row[iAvgCpu] != null ? Number(row[iAvgCpu]) : null,
    avgMemory: row[iAvgMemory] != null ? Number(row[iAvgMemory]) : null,
  }));
}

export function parsePodInventory(response: EsqlResponse): PodRow[] {
  const cols = response.columns;
  const iPodName = columnIndex(cols, "pod_name");
  const iNamespace = columnIndex(cols, "namespace_name");
  const iNodeName = columnIndex(cols, "node_name");
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
  const iPodName = columnIndex(cols, "pod_name");
  const iNamespace = columnIndex(cols, "namespace_name");
  const iNodeName = columnIndex(cols, "node_name");
  const iContainerName = columnIndex(cols, "container_name");
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

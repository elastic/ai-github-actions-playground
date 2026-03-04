/**
 * ES|QL query builders for Kubernetes observability pages.
 * Aggregates inventory and detail views for clusters, namespaces, workloads, and pods
 * from OTel metrics, logs, and traces indexed via the Elastic OTel distribution.
 */
import { escapeEsqlString } from "../../services/es/esqlUtils";
import {
  buildPipeline,
  buildWherePipe,
  normalizeTimeExpression,
} from "../../services/es/queryParts";

// ---------------------------------------------------------------------------
// Field mapping
// ---------------------------------------------------------------------------

export interface K8sFieldMapping {
  /** Metric index pattern (e.g. metrics-*) */
  metricsIndex: string;
  /** Log index pattern (e.g. logs-*) */
  logsIndex: string;
  /** Trace index pattern (e.g. traces-*) */
  tracesIndex: string;
  timestamp: string;
  clusterName: string;
  namespace: string;
  podName: string;
  nodeName: string;
  containerName: string;
  deploymentName: string;
  replicaSetName: string;
  statefulSetName: string;
  daemonSetName: string;
  jobName: string;
  cronJobName: string;
  cpuUsage: string;
  memoryUsage: string;
  podPhase: string;
  restartCount: string;
  serviceName: string;
}

export const DEFAULT_K8S_FIELD_MAPPING: K8sFieldMapping = {
  metricsIndex: "metrics-*",
  logsIndex: "logs-*",
  tracesIndex: "traces-*",
  timestamp: "@timestamp",
  clusterName: "k8s.cluster.name",
  namespace: "k8s.namespace.name",
  podName: "k8s.pod.name",
  nodeName: "k8s.node.name",
  containerName: "k8s.container.name",
  deploymentName: "k8s.deployment.name",
  replicaSetName: "k8s.replicaset.name",
  statefulSetName: "k8s.statefulset.name",
  daemonSetName: "k8s.daemonset.name",
  jobName: "k8s.job.name",
  cronJobName: "k8s.cronjob.name",
  cpuUsage: "k8s.pod.cpu.utilization",
  memoryUsage: "k8s.pod.memory.usage",
  podPhase: "k8s.pod.phase",
  restartCount: "k8s.container.restarts",
  serviceName: "service.name",
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface K8sQueryFilters {
  timeFrom: string;
  timeTo: string;
  cluster?: string;
  namespace?: string;
}

function toSafeRelativeTimeExpression(value: string): string {
  const normalized = normalizeTimeExpression(value);
  if (normalized) return normalized;
  throw new Error(`Unsupported time expression: ${value}`);
}

function buildTimeWhereClauses(filters: K8sQueryFilters, fields: K8sFieldMapping): string[] {
  const safeTimeFrom = toSafeRelativeTimeExpression(filters.timeFrom);
  const safeTimeTo = toSafeRelativeTimeExpression(filters.timeTo);
  const clauses: string[] = [
    `${fields.timestamp} >= ${safeTimeFrom}`,
    `${fields.timestamp} <= ${safeTimeTo}`,
  ];
  if (filters.cluster) {
    clauses.push(`${fields.clusterName} == "${escapeEsqlString(filters.cluster)}"`);
  }
  if (filters.namespace) {
    clauses.push(`${fields.namespace} == "${escapeEsqlString(filters.namespace)}"`);
  }
  return clauses;
}

// ---------------------------------------------------------------------------
// Cluster inventory
// ---------------------------------------------------------------------------

/**
 * Aggregates per-cluster metrics: pod count, avg CPU, avg memory.
 */
export function buildClusterInventoryQuery(
  filters: K8sQueryFilters,
  fields: K8sFieldMapping = DEFAULT_K8S_FIELD_MAPPING,
): string {
  const whereClauses = buildTimeWhereClauses(filters, fields);
  whereClauses.push(`${fields.podName} IS NOT NULL`);

  return buildPipeline([
    `FROM ${fields.metricsIndex}`,
    buildWherePipe(whereClauses),
    `STATS pod_count = COUNT_DISTINCT(${fields.podName}), avg_cpu = AVG(${fields.cpuUsage}), avg_memory = AVG(${fields.memoryUsage}), namespace_count = COUNT_DISTINCT(${fields.namespace}), node_count = COUNT_DISTINCT(${fields.nodeName}) BY cluster_name = ${fields.clusterName}`,
    `SORT pod_count DESC`,
    `LIMIT 100`,
  ]);
}

// ---------------------------------------------------------------------------
// Namespace inventory
// ---------------------------------------------------------------------------

/**
 * Aggregates per-namespace metrics within a cluster.
 */
export function buildNamespaceInventoryQuery(
  filters: K8sQueryFilters,
  fields: K8sFieldMapping = DEFAULT_K8S_FIELD_MAPPING,
): string {
  const whereClauses = buildTimeWhereClauses(filters, fields);
  whereClauses.push(`${fields.podName} IS NOT NULL`);

  return buildPipeline([
    `FROM ${fields.metricsIndex}`,
    buildWherePipe(whereClauses),
    `STATS pod_count = COUNT_DISTINCT(${fields.podName}), avg_cpu = AVG(${fields.cpuUsage}), avg_memory = AVG(${fields.memoryUsage}) BY namespace_name = ${fields.namespace}`,
    `SORT pod_count DESC`,
    `LIMIT 200`,
  ]);
}

// ---------------------------------------------------------------------------
// Workload inventory
// ---------------------------------------------------------------------------

export type WorkloadKind =
  | "deployment"
  | "replicaset"
  | "statefulset"
  | "daemonset"
  | "job"
  | "cronjob";

function workloadField(kind: WorkloadKind, fields: K8sFieldMapping): string {
  const map: Record<WorkloadKind, string> = {
    deployment: fields.deploymentName,
    replicaset: fields.replicaSetName,
    statefulset: fields.statefulSetName,
    daemonset: fields.daemonSetName,
    job: fields.jobName,
    cronjob: fields.cronJobName,
  };
  return map[kind];
}

/**
 * Aggregates per-workload metrics within a namespace.
 */
export function buildWorkloadInventoryQuery(
  kind: WorkloadKind,
  filters: K8sQueryFilters,
  fields: K8sFieldMapping = DEFAULT_K8S_FIELD_MAPPING,
): string {
  const nameField = workloadField(kind, fields);
  const whereClauses = buildTimeWhereClauses(filters, fields);
  whereClauses.push(`${nameField} IS NOT NULL`);

  return buildPipeline([
    `FROM ${fields.metricsIndex}`,
    buildWherePipe(whereClauses),
    `STATS pod_count = COUNT_DISTINCT(${fields.podName}), avg_cpu = AVG(${fields.cpuUsage}), avg_memory = AVG(${fields.memoryUsage}) BY workload_name = ${nameField}`,
    `SORT pod_count DESC`,
    `LIMIT 200`,
  ]);
}

/**
 * Aggregates per-workload metrics across all workload kinds within a namespace.
 */
export function buildAllWorkloadsInventoryQuery(
  filters: K8sQueryFilters,
  fields: K8sFieldMapping = DEFAULT_K8S_FIELD_MAPPING,
): string {
  const workloadFields = [
    fields.deploymentName,
    fields.replicaSetName,
    fields.statefulSetName,
    fields.daemonSetName,
    fields.jobName,
    fields.cronJobName,
  ];
  const whereClauses = buildTimeWhereClauses(filters, fields);
  whereClauses.push(`(${workloadFields.map((field) => `${field} IS NOT NULL`).join(" OR ")})`);

  return buildPipeline([
    `FROM ${fields.metricsIndex}`,
    buildWherePipe(whereClauses),
    `STATS pod_count = COUNT_DISTINCT(${fields.podName}), avg_cpu = AVG(${fields.cpuUsage}), avg_memory = AVG(${fields.memoryUsage}) BY cluster_name = ${fields.clusterName}, namespace_name = ${fields.namespace}, workload_name = COALESCE(${workloadFields.join(", ")})`,
    `SORT pod_count DESC`,
    `LIMIT 200`,
  ]);
}

// ---------------------------------------------------------------------------
// Pod inventory
// ---------------------------------------------------------------------------

/**
 * Lists pods with per-pod metrics.
 */
export function buildPodInventoryQuery(
  filters: K8sQueryFilters,
  fields: K8sFieldMapping = DEFAULT_K8S_FIELD_MAPPING,
): string {
  const whereClauses = buildTimeWhereClauses(filters, fields);
  whereClauses.push(`${fields.podName} IS NOT NULL`);

  return buildPipeline([
    `FROM ${fields.metricsIndex}`,
    buildWherePipe(whereClauses),
    `STATS avg_cpu = AVG(${fields.cpuUsage}), avg_memory = AVG(${fields.memoryUsage}), restarts = SUM(${fields.restartCount}) BY pod_name = ${fields.podName}, namespace_name = ${fields.namespace}, node_name = ${fields.nodeName}`,
    `SORT avg_cpu DESC`,
    `LIMIT 500`,
  ]);
}

// ---------------------------------------------------------------------------
// Pod detail
// ---------------------------------------------------------------------------

/**
 * Fetches detailed metrics for a single pod.
 */
export function buildPodDetailQuery(
  podName: string,
  filters: K8sQueryFilters,
  fields: K8sFieldMapping = DEFAULT_K8S_FIELD_MAPPING,
): string {
  const whereClauses = buildTimeWhereClauses(filters, fields);
  whereClauses.push(`${fields.podName} == "${escapeEsqlString(podName)}"`);

  return buildPipeline([
    `FROM ${fields.metricsIndex}`,
    buildWherePipe(whereClauses),
    `STATS avg_cpu = AVG(${fields.cpuUsage}), avg_memory = AVG(${fields.memoryUsage}), restarts = SUM(${fields.restartCount}) BY pod_name = ${fields.podName}, namespace_name = ${fields.namespace}, node_name = ${fields.nodeName}, container_name = ${fields.containerName}`,
    `SORT container_name`,
    `LIMIT 100`,
  ]);
}

// ---------------------------------------------------------------------------
// Kubernetes logs
// ---------------------------------------------------------------------------

/**
 * Fetches recent logs for a Kubernetes entity.
 */
export function buildK8sLogsQuery(
  filters: K8sQueryFilters & { podName?: string },
  fields: K8sFieldMapping = DEFAULT_K8S_FIELD_MAPPING,
): string {
  const whereClauses = buildTimeWhereClauses(filters, fields);
  if (filters.podName) {
    whereClauses.push(`${fields.podName} == "${escapeEsqlString(filters.podName)}"`);
  }

  return buildPipeline([
    `FROM ${fields.logsIndex}`,
    buildWherePipe(whereClauses),
    `SORT ${fields.timestamp} DESC`,
    `KEEP ${fields.timestamp}, ${fields.podName}, ${fields.namespace}, ${fields.containerName}, message`,
    `LIMIT 500`,
  ]);
}

// ---------------------------------------------------------------------------
// Kubernetes traces
// ---------------------------------------------------------------------------

/**
 * Fetches recent traces for a Kubernetes entity.
 */
export function buildK8sTracesQuery(
  filters: K8sQueryFilters & { podName?: string },
  fields: K8sFieldMapping = DEFAULT_K8S_FIELD_MAPPING,
): string {
  const whereClauses = buildTimeWhereClauses(filters, fields);
  if (filters.podName) {
    whereClauses.push(`${fields.podName} == "${escapeEsqlString(filters.podName)}"`);
  }

  return buildPipeline([
    `FROM ${fields.tracesIndex}`,
    buildWherePipe(whereClauses),
    `SORT ${fields.timestamp} DESC`,
    `KEEP ${fields.timestamp}, ${fields.serviceName}, ${fields.podName}, ${fields.namespace}, name, trace.id, span.id`,
    `LIMIT 500`,
  ]);
}

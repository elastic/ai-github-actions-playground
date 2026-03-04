import {
  formatCpu,
  formatMemory,
  type ClusterRow,
  type NamespaceRow,
  type WorkloadRow,
  type PodRow,
} from "./k8sHelpers";

export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable: boolean;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
}

export const CLUSTER_COLUMNS: ColumnDef<ClusterRow>[] = [
  { key: "clusterName", label: "Cluster", sortable: true, render: (r) => r.clusterName },
  {
    key: "podCount",
    label: "Pods",
    sortable: true,
    align: "right",
    render: (r) => r.podCount.toLocaleString(),
  },
  {
    key: "namespaceCount",
    label: "Namespaces",
    sortable: true,
    align: "right",
    render: (r) => r.namespaceCount.toLocaleString(),
  },
  {
    key: "nodeCount",
    label: "Nodes",
    sortable: true,
    align: "right",
    render: (r) => r.nodeCount.toLocaleString(),
  },
  {
    key: "avgCpu",
    label: "Avg CPU",
    sortable: true,
    align: "right",
    render: (r) => formatCpu(r.avgCpu),
  },
  {
    key: "avgMemory",
    label: "Avg Memory",
    sortable: true,
    align: "right",
    render: (r) => formatMemory(r.avgMemory),
  },
];

export const NAMESPACE_COLUMNS: ColumnDef<NamespaceRow>[] = [
  { key: "namespace", label: "Namespace", sortable: true, render: (r) => r.namespace },
  {
    key: "podCount",
    label: "Pods",
    sortable: true,
    align: "right",
    render: (r) => r.podCount.toLocaleString(),
  },
  {
    key: "avgCpu",
    label: "Avg CPU",
    sortable: true,
    align: "right",
    render: (r) => formatCpu(r.avgCpu),
  },
  {
    key: "avgMemory",
    label: "Avg Memory",
    sortable: true,
    align: "right",
    render: (r) => formatMemory(r.avgMemory),
  },
];

export const WORKLOAD_COLUMNS: ColumnDef<WorkloadRow>[] = [
  { key: "workloadName", label: "Workload", sortable: true, render: (r) => r.workloadName },
  {
    key: "podCount",
    label: "Pods",
    sortable: true,
    align: "right",
    render: (r) => r.podCount.toLocaleString(),
  },
  {
    key: "avgCpu",
    label: "Avg CPU",
    sortable: true,
    align: "right",
    render: (r) => formatCpu(r.avgCpu),
  },
  {
    key: "avgMemory",
    label: "Avg Memory",
    sortable: true,
    align: "right",
    render: (r) => formatMemory(r.avgMemory),
  },
];

export const POD_COLUMNS: ColumnDef<PodRow>[] = [
  { key: "podName", label: "Pod", sortable: true, render: (r) => r.podName },
  { key: "namespace", label: "Namespace", sortable: true, render: (r) => r.namespace },
  { key: "nodeName", label: "Node", sortable: true, render: (r) => r.nodeName },
  {
    key: "avgCpu",
    label: "Avg CPU",
    sortable: true,
    align: "right",
    render: (r) => formatCpu(r.avgCpu),
  },
  {
    key: "avgMemory",
    label: "Avg Memory",
    sortable: true,
    align: "right",
    render: (r) => formatMemory(r.avgMemory),
  },
  {
    key: "restarts",
    label: "Restarts",
    sortable: true,
    align: "right",
    render: (r) => r.restarts.toLocaleString(),
  },
];

import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";

import type { KubernetesActiveTab } from "../../types/pageFilters";

import type { ClusterRow, NamespaceRow, WorkloadRow, PodRow } from "./k8sHelpers";
import type { K8sSortDirection } from "./useK8sInventorySearch";

// ---------------------------------------------------------------------------
// Column config
// ---------------------------------------------------------------------------

interface ColumnDef<T> {
  key: string;
  label: string;
  sortable: boolean;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
}

function formatCpu(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatMemory(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GiB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

const CLUSTER_COLUMNS: ColumnDef<ClusterRow>[] = [
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

const NAMESPACE_COLUMNS: ColumnDef<NamespaceRow>[] = [
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

const WORKLOAD_COLUMNS: ColumnDef<WorkloadRow>[] = [
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

const POD_COLUMNS: ColumnDef<PodRow>[] = [
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface K8sInventoryTableProps {
  activeTab: KubernetesActiveTab;
  clusterRows: ClusterRow[];
  namespaceRows: NamespaceRow[];
  workloadRows: WorkloadRow[];
  podRows: PodRow[];
  sortField: string;
  sortDirection: K8sSortDirection;
  handleSort: (field: string) => void;
}

// ---------------------------------------------------------------------------
// Generic table renderer
// ---------------------------------------------------------------------------

function renderTable<T>(
  columns: ColumnDef<T>[],
  rows: T[],
  sortField: string,
  sortDirection: K8sSortDirection,
  handleSort: (field: string) => void,
  ariaLabel: string,
  rowKey: (row: T) => string,
) {
  return (
    <Table size="medium" aria-label={ariaLabel}>
      <TableHead>
        <TableRow>
          {columns.map((col) => (
            <TableCell key={col.key} align={col.align ?? "left"}>
              {col.sortable ? (
                <TableSortLabel
                  active={sortField === col.key}
                  direction={sortField === col.key ? sortDirection : "asc"}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                </TableSortLabel>
              ) : (
                col.label
              )}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={rowKey(row)} hover>
            {columns.map((col) => (
              <TableCell key={col.key} align={col.align ?? "left"}>
                <Typography variant="body2">{col.render(row)}</Typography>
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function K8sInventoryTable({
  activeTab,
  clusterRows,
  namespaceRows,
  workloadRows,
  podRows,
  sortField,
  sortDirection,
  handleSort,
}: K8sInventoryTableProps) {
  switch (activeTab) {
    case "clusters":
      return renderTable(
        CLUSTER_COLUMNS,
        clusterRows,
        sortField,
        sortDirection,
        handleSort,
        "Cluster inventory",
        (r) => r.clusterName,
      );
    case "namespaces":
      return renderTable(
        NAMESPACE_COLUMNS,
        namespaceRows,
        sortField,
        sortDirection,
        handleSort,
        "Namespace inventory",
        (r) => r.namespace,
      );
    case "workloads":
      return renderTable(
        WORKLOAD_COLUMNS,
        workloadRows,
        sortField,
        sortDirection,
        handleSort,
        "Workload inventory",
        (r) => r.workloadName,
      );
    case "pods":
      return renderTable(
        POD_COLUMNS,
        podRows,
        sortField,
        sortDirection,
        handleSort,
        "Pod inventory",
        (r) => r.podName,
      );
  }
}

import type { KubernetesActiveTab } from "../../types/pageFilters";

import {
  CLUSTER_COLUMNS,
  NAMESPACE_COLUMNS,
  POD_COLUMNS,
  WORKLOAD_COLUMNS,
} from "./k8sInventoryColumns";
import { renderTable } from "./k8sInventoryTableRenderer";
import { type ClusterRow, type NamespaceRow, type WorkloadRow, type PodRow } from "./k8sHelpers";
import type { K8sSortDirection } from "./useK8sInventorySearch";

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
        (r) => `${r.clusterName}-${r.namespace}`,
      );
    case "workloads":
      return renderTable(
        WORKLOAD_COLUMNS,
        workloadRows,
        sortField,
        sortDirection,
        handleSort,
        "Workload inventory",
        (r) => `${r.clusterName}-${r.namespace}-${r.workloadKind}-${r.workloadName}`,
      );
    case "pods":
      return renderTable(
        POD_COLUMNS,
        podRows,
        sortField,
        sortDirection,
        handleSort,
        "Pod inventory",
        (r) => `${r.clusterName}-${r.namespace}-${r.podName}-${r.nodeName}`,
      );
    default: {
      const _exhaustive: never = activeTab;
      return _exhaustive;
    }
  }
}

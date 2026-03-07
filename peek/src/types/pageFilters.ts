export interface ServiceInventoryFilters {
  timeFrom: string;
  timeTo: string;
}

export const DEFAULT_SERVICE_INVENTORY_FILTERS: ServiceInventoryFilters = {
  timeFrom: "NOW() - 1 hour",
  timeTo: "NOW()",
};

export interface ProfilingFilters {
  executableName: string | null;
  threadName: string | null;
  serviceName: string | null;
  hostName: string | null;
  timeFrom: string;
  timeTo: string;
  limit: number;
}

export const EMPTY_PROFILING_FILTERS: ProfilingFilters = {
  executableName: null,
  threadName: null,
  serviceName: null,
  hostName: null,
  timeFrom: "NOW() - 1 hour",
  timeTo: "NOW()",
  limit: 100,
};

export type KubernetesActiveTab = "clusters" | "namespaces" | "workloads" | "pods";

export interface KubernetesFilters {
  timeFrom: string;
  timeTo: string;
  cluster: string | null;
  namespace: string | null;
  activeTab: KubernetesActiveTab;
}

export const DEFAULT_KUBERNETES_FILTERS: KubernetesFilters = {
  timeFrom: "NOW() - 1 hour",
  timeTo: "NOW()",
  cluster: null,
  namespace: null,
  activeTab: "clusters",
};

export type HostsOsFilter = "all" | "linux" | "windows" | "macos";

export interface HostsFilters {
  timeFrom: string;
  timeTo: string;
  osFilter: HostsOsFilter;
  search: string;
}

export const DEFAULT_HOSTS_FILTERS: HostsFilters = {
  timeFrom: "NOW() - 1 hour",
  timeTo: "NOW()",
  osFilter: "all",
  search: "",
};

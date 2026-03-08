import { type ComponentType, lazy } from "react";
import { PAGE_PATHS, type PagePathConfig } from "./paths";

const PackageBuilderPage = lazy(() => import("../components/PackageBuilderPage"));
const ApiConsolePage = lazy(() => import("../components/ApiConsolePage"));

const ApiKeysPage = lazy(() => import("../components/ApiKeysPage"));
const ChatPage = lazy(() => import("../components/ChatPage"));
const ClusterCapacityPage = lazy(() => import("../components/ClusterCapacityPage"));
const ClusterHealthPage = lazy(() => import("../components/ClusterHealthPage"));
const ClusterOverviewPage = lazy(() => import("../components/ClusterOverviewPage"));
const ClusterSettingsPage = lazy(() => import("../components/ClusterSettingsPage"));
const NodesHotThreadsPage = lazy(() => import("../components/NodesHotThreadsPage"));
const ClusterResiliencePage = lazy(() => import("../components/ClusterResiliencePage"));
const ClusterShardsPage = lazy(() => import("../components/ClusterShardsPage"));
const DashboardsLandingPage = lazy(() => import("../components/DashboardsLandingPage"));
const DataStreamsPage = lazy(() => import("../components/DataStreamsPage"));
const AddDataPage = lazy(() => import("../components/AddDataPage"));
const DiscoverPage = lazy(() => import("../components/DiscoverPage"));
const LogsLandingPage = lazy(() => import("../components/logs/LogsLandingPage"));
const LogsPage = lazy(() => import("../components/logs/LogsPage"));
const DocsPage = lazy(() => import("../components/DocsPage"));
const ExplorePage = lazy(() => import("../components/ExplorePage"));
const FleetAgentPage = lazy(() => import("../components/FleetAgentPage"));
const FleetPage = lazy(() => import("../components/FleetPage"));
const ClusterDiagnosticsPage = lazy(() => import("../components/ClusterDiagnosticsPage"));
const IngestPipelinesPage = lazy(() => import("../components/IngestPipelinesPage"));
const IndicesPage = lazy(() => import("../components/IndicesPage"));
const StorageExplorerPage = lazy(() => import("../components/StorageExplorerPage"));
const NodesPage = lazy(() => import("../components/NodesPage"));
const NodeDetailPage = lazy(() => import("../components/NodeDetailPage"));
const RolesPage = lazy(() => import("../components/RolesPage"));
const ServiceDashboardPage = lazy(() => import("../components/services/ServiceDashboardPage"));
const ServiceInventoryPage = lazy(() => import("../components/services/ServiceInventoryPage"));
const SettingsPage = lazy(() => import("../components/SettingsPage"));
const TracesPage = lazy(() => import("../components/traces/TracesPage"));
const ProfilingPage = lazy(() => import("../components/profiling/ProfilingPage"));
const ProfilingGuidedPage = lazy(() => import("../components/profiling/ProfilingGuidedPage"));
const InvestigatePage = lazy(() => import("../components/InvestigatePage"));
const UsersPage = lazy(() => import("../components/UsersPage"));
const WatcherGetWatchPage = lazy(() => import("../components/WatcherGetWatchPage"));
const KubernetesPage = lazy(() => import("../components/kubernetes/KubernetesPage"));
const K8sClusterDashboardPage = lazy(
  () => import("../components/kubernetes/K8sClusterDashboardPage"),
);
const K8sNamespaceDashboardPage = lazy(
  () => import("../components/kubernetes/K8sNamespaceDashboardPage"),
);
const K8sWorkloadDashboardPage = lazy(
  () => import("../components/kubernetes/K8sWorkloadDashboardPage"),
);
const K8sPodDashboardPage = lazy(() => import("../components/kubernetes/K8sPodDashboardPage"));
const HostsPage = lazy(() => import("../components/hosts/HostsPage"));
const HostDetailPage = lazy(() => import("../components/hosts/HostDetailPage"));
const HostsLinuxPage = lazy(() => import("../components/hosts/HostsLinuxPage"));
const HostsWindowsPage = lazy(() => import("../components/hosts/HostsWindowsPage"));
const HostsMacosPage = lazy(() => import("../components/hosts/HostsMacosPage"));
const TaskManagerPage = lazy(() => import("../components/TaskManagerPage"));
const IlmPage = lazy(() => import("../components/IlmPage"));
const TemplatesPage = lazy(() => import("../components/TemplatesPage"));

export interface PageConfig extends PagePathConfig {
  component: ComponentType;
}

export const PAGE_MANIFEST: Record<keyof typeof PAGE_PATHS, PageConfig> = {
  dashboards: {
    ...PAGE_PATHS.dashboards,
    component: DashboardsLandingPage,
  },
  discover: {
    ...PAGE_PATHS.discover,
    component: DiscoverPage,
  },
  logs: {
    ...PAGE_PATHS.logs,
    component: LogsLandingPage,
  },
  logsExplorer: {
    ...PAGE_PATHS.logsExplorer,
    component: LogsPage,
  },
  explore: {
    ...PAGE_PATHS.explore,
    component: ExplorePage,
  },
  traces: {
    ...PAGE_PATHS.traces,
    component: TracesPage,
  },
  profiling: {
    ...PAGE_PATHS.profiling,
    component: ProfilingGuidedPage,
  },
  profilingAdvanced: {
    ...PAGE_PATHS.profilingAdvanced,
    component: ProfilingPage,
  },
  services: {
    ...PAGE_PATHS.services,
    component: ServiceInventoryPage,
  },
  serviceDashboard: {
    ...PAGE_PATHS.serviceDashboard,
    component: ServiceDashboardPage,
  },
  kubernetes: {
    ...PAGE_PATHS.kubernetes,
    component: KubernetesPage,
  },
  kubernetesCluster: {
    ...PAGE_PATHS.kubernetesCluster,
    component: K8sClusterDashboardPage,
  },
  kubernetesNamespace: {
    ...PAGE_PATHS.kubernetesNamespace,
    component: K8sNamespaceDashboardPage,
  },
  kubernetesWorkload: {
    ...PAGE_PATHS.kubernetesWorkload,
    component: K8sWorkloadDashboardPage,
  },
  kubernetesPod: {
    ...PAGE_PATHS.kubernetesPod,
    component: K8sPodDashboardPage,
  },
  hosts: {
    ...PAGE_PATHS.hosts,
    component: HostsPage,
  },
  hostsLinux: {
    ...PAGE_PATHS.hostsLinux,
    component: HostsLinuxPage,
  },
  hostsWindows: {
    ...PAGE_PATHS.hostsWindows,
    component: HostsWindowsPage,
  },
  hostsMacos: {
    ...PAGE_PATHS.hostsMacos,
    component: HostsMacosPage,
  },
  hostDetail: {
    ...PAGE_PATHS.hostDetail,
    component: HostDetailPage,
  },
  console: {
    ...PAGE_PATHS.console,
    component: ApiConsolePage,
  },
  chat: {
    ...PAGE_PATHS.chat,
    component: ChatPage,
  },
  clusterOverview: {
    ...PAGE_PATHS.clusterOverview,
    component: ClusterOverviewPage,
  },
  clusterHealth: {
    ...PAGE_PATHS.clusterHealth,
    component: ClusterHealthPage,
  },
  globalHealth: {
    ...PAGE_PATHS.globalHealth,
    component: ClusterHealthPage,
  },
  clusterDiagnostics: {
    ...PAGE_PATHS.clusterDiagnostics,
    component: ClusterDiagnosticsPage,
  },
  clusterTasks: {
    ...PAGE_PATHS.clusterTasks,
    component: TaskManagerPage,
  },
  clusterCapacity: {
    ...PAGE_PATHS.clusterCapacity,
    component: ClusterCapacityPage,
  },
  clusterShards: {
    ...PAGE_PATHS.clusterShards,
    component: ClusterShardsPage,
  },
  clusterResilience: {
    ...PAGE_PATHS.clusterResilience,
    component: ClusterResiliencePage,
  },
  addData: {
    ...PAGE_PATHS.addData,
    component: AddDataPage,
  },
  packageBuilder: {
    ...PAGE_PATHS.packageBuilder,
    component: PackageBuilderPage,
  },
  dataStreams: {
    ...PAGE_PATHS.dataStreams,
    component: DataStreamsPage,
  },
  nodes: {
    ...PAGE_PATHS.nodes,
    component: NodesPage,
  },
  nodeDetail: {
    ...PAGE_PATHS.nodeDetail,
    component: NodeDetailPage,
  },
  indices: {
    ...PAGE_PATHS.indices,
    component: IndicesPage,
  },
  storageExplorer: {
    ...PAGE_PATHS.storageExplorer,
    component: StorageExplorerPage,
  },
  ingestPipelines: {
    ...PAGE_PATHS.ingestPipelines,
    component: IngestPipelinesPage,
  },
  clusterSettings: {
    ...PAGE_PATHS.clusterSettings,
    component: ClusterSettingsPage,
  },
  nodesHotThreads: {
    ...PAGE_PATHS.nodesHotThreads,
    component: NodesHotThreadsPage,
  },
  watcherGetWatch: {
    ...PAGE_PATHS.watcherGetWatch,
    component: WatcherGetWatchPage,
  },
  ilm: {
    ...PAGE_PATHS.ilm,
    component: IlmPage,
  },
  templates: {
    ...PAGE_PATHS.templates,
    component: TemplatesPage,
  },
  fleet: {
    ...PAGE_PATHS.fleet,
    component: FleetPage,
  },
  fleetAgentDetail: {
    ...PAGE_PATHS.fleetAgentDetail,
    component: FleetAgentPage,
  },
  investigate: {
    ...PAGE_PATHS.investigate,
    component: InvestigatePage,
  },
  users: {
    ...PAGE_PATHS.users,
    component: UsersPage,
  },
  apiKeys: {
    ...PAGE_PATHS.apiKeys,
    component: ApiKeysPage,
  },
  roles: {
    ...PAGE_PATHS.roles,
    component: RolesPage,
  },
  docs: {
    ...PAGE_PATHS.docs,
    component: DocsPage,
  },
  settings: {
    ...PAGE_PATHS.settings,
    component: SettingsPage,
  },
};

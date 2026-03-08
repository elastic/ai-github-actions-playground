import { type ComponentType, lazy } from "react";
import type { PageId } from "./paths";

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
const TransformsPage = lazy(() => import("../components/TransformsPage"));

export const PAGE_MANIFEST: Record<PageId, ComponentType> = {
  dashboards: DashboardsLandingPage,
  discover: DiscoverPage,
  logs: LogsLandingPage,
  logsExplorer: LogsPage,
  explore: ExplorePage,
  traces: TracesPage,
  profiling: ProfilingGuidedPage,
  profilingAdvanced: ProfilingPage,
  services: ServiceInventoryPage,
  serviceDashboard: ServiceDashboardPage,
  kubernetes: KubernetesPage,
  kubernetesCluster: K8sClusterDashboardPage,
  kubernetesNamespace: K8sNamespaceDashboardPage,
  kubernetesWorkload: K8sWorkloadDashboardPage,
  kubernetesPod: K8sPodDashboardPage,
  hosts: HostsPage,
  hostsLinux: HostsLinuxPage,
  hostsWindows: HostsWindowsPage,
  hostsMacos: HostsMacosPage,
  hostDetail: HostDetailPage,
  console: ApiConsolePage,
  chat: ChatPage,
  clusterOverview: ClusterOverviewPage,
  clusterHealth: ClusterHealthPage,
  globalHealth: ClusterHealthPage,
  clusterDiagnostics: ClusterDiagnosticsPage,
  clusterTasks: TaskManagerPage,
  clusterCapacity: ClusterCapacityPage,
  clusterShards: ClusterShardsPage,
  clusterResilience: ClusterResiliencePage,
  addData: AddDataPage,
  packageBuilder: PackageBuilderPage,
  dataStreams: DataStreamsPage,
  nodes: NodesPage,
  nodeDetail: NodeDetailPage,
  indices: IndicesPage,
  storageExplorer: StorageExplorerPage,
  ingestPipelines: IngestPipelinesPage,
  clusterSettings: ClusterSettingsPage,
  nodesHotThreads: NodesHotThreadsPage,
  watcherGetWatch: WatcherGetWatchPage,
  ilm: IlmPage,
  transforms: TransformsPage,
  templates: TemplatesPage,
  fleet: FleetPage,
  fleetAgentDetail: FleetAgentPage,
  investigate: InvestigatePage,
  users: UsersPage,
  apiKeys: ApiKeysPage,
  roles: RolesPage,
  docs: DocsPage,
  settings: SettingsPage,
};

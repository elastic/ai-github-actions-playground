import { type ComponentType, type ReactNode, createElement, lazy } from "react";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SearchIcon from "@mui/icons-material/Search";
import ExploreIcon from "@mui/icons-material/Explore";
import TimelineIcon from "@mui/icons-material/Timeline";
import TerminalIcon from "@mui/icons-material/Terminal";
import ChatIcon from "@mui/icons-material/Chat";
import InfoIcon from "@mui/icons-material/Info";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import DatasetIcon from "@mui/icons-material/Dataset";
import PeopleIcon from "@mui/icons-material/People";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SecurityIcon from "@mui/icons-material/Security";
import SettingsIcon from "@mui/icons-material/Settings";
import SpeedIcon from "@mui/icons-material/Speed";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import StorageIcon from "@mui/icons-material/Storage";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import MemoryIcon from "@mui/icons-material/Memory";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ShieldIcon from "@mui/icons-material/Shield";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import PolicyIcon from "@mui/icons-material/Policy";
import MiscellaneousServicesIcon from "@mui/icons-material/MiscellaneousServices";
import SubjectIcon from "@mui/icons-material/Subject";
import CloudIcon from "@mui/icons-material/Cloud";
import DnsIcon from "@mui/icons-material/Dns";
import DescriptionIcon from "@mui/icons-material/Description";
import BackupIcon from "@mui/icons-material/Backup";

import type { UserCapabilities } from "../services/es";

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
const GlobalHealthPage = lazy(() => import("../components/GlobalHealthPage"));
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
const SnapshotsPage = lazy(() => import("../components/SnapshotsPage"));

export type NavGroup = "Data" | "Workspace" | "Security" | "System" | "Help" | "Settings";

export interface PageConfig {
  path: string;
  component: ComponentType;
  requiresConnection: boolean;
  showTimeControls: boolean;
  /** Key of `UserCapabilities` that must be `true` for the page to appear in the sidebar. */
  requiredCapability?: keyof UserCapabilities;
  /** ContentSkeleton variant shown while the lazy page chunk loads. */
  skeletonVariant?: "table" | "cards" | "chart" | "list" | "detail-panel";
  nav: {
    label: string;
    group: NavGroup;
    order: number;
    showInSidebar: boolean;
    icon?: ReactNode;
  };
}

export const PAGE_MANIFEST = {
  dashboards: {
    path: "/dashboards",
    component: DashboardsLandingPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "cards",
    nav: {
      label: "Dashboards",
      group: "Workspace",
      order: 10,
      showInSidebar: true,
      icon: createElement(DashboardIcon, { fontSize: "small" }),
    },
  },
  discover: {
    path: "/discover",
    component: DiscoverPage,
    requiresConnection: true,
    showTimeControls: true,
    skeletonVariant: "table",
    nav: {
      label: "Query Lab",
      group: "Data",
      order: 20,
      showInSidebar: true,
      icon: createElement(SearchIcon, { fontSize: "small" }),
    },
  },
  logs: {
    path: "/logs",
    component: LogsLandingPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "list",
    nav: {
      label: "Logs",
      group: "Data",
      order: 30,
      showInSidebar: true,
      icon: createElement(SubjectIcon, { fontSize: "small" }),
    },
  },
  logsExplorer: {
    path: "/logs-explorer",
    component: LogsPage,
    requiresConnection: true,
    showTimeControls: true,
    skeletonVariant: "table",
    nav: {
      label: "Logs Explorer",
      group: "Data",
      order: 31,
      showInSidebar: false,
      icon: createElement(SubjectIcon, { fontSize: "small" }),
    },
  },
  explore: {
    path: "/explore",
    component: ExplorePage,
    requiresConnection: true,
    showTimeControls: true,
    skeletonVariant: "chart",
    nav: {
      label: "Metrics",
      group: "Data",
      order: 40,
      showInSidebar: true,
      icon: createElement(ExploreIcon, { fontSize: "small" }),
    },
  },
  traces: {
    path: "/traces",
    component: TracesPage,
    requiresConnection: true,
    showTimeControls: true,
    skeletonVariant: "table",
    nav: {
      label: "Traces",
      group: "Data",
      order: 50,
      showInSidebar: true,
      icon: createElement(TimelineIcon, { fontSize: "small" }),
    },
  },
  profiling: {
    path: "/profiling",
    component: ProfilingGuidedPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "chart",
    nav: {
      label: "Profiling",
      group: "Data",
      order: 60,
      showInSidebar: true,
      icon: createElement(SpeedIcon, { fontSize: "small" }),
    },
  },
  profilingAdvanced: {
    path: "/profiling/advanced",
    component: ProfilingPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "chart",
    nav: {
      label: "Profiling (Advanced)",
      group: "Data",
      order: 61,
      showInSidebar: false,
      icon: createElement(SpeedIcon, { fontSize: "small" }),
    },
  },
  services: {
    path: "/services",
    component: ServiceInventoryPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Services",
      group: "Workspace",
      order: 20,
      showInSidebar: true,
      icon: createElement(MiscellaneousServicesIcon, { fontSize: "small" }),
    },
  },
  serviceDashboard: {
    path: "/services/:serviceName",
    component: ServiceDashboardPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "detail-panel",
    nav: {
      label: "Service Dashboard",
      group: "Workspace",
      order: 21,
      showInSidebar: false,
      icon: createElement(MiscellaneousServicesIcon, { fontSize: "small" }),
    },
  },
  kubernetes: {
    path: "/kubernetes",
    component: KubernetesPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Kubernetes",
      group: "Workspace",
      order: 30,
      showInSidebar: true,
      icon: createElement(CloudIcon, { fontSize: "small" }),
    },
  },
  kubernetesCluster: {
    path: "/kubernetes/cluster/:clusterName",
    component: K8sClusterDashboardPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "detail-panel",
    nav: {
      label: "Kubernetes Cluster",
      group: "Workspace",
      order: 31,
      showInSidebar: false,
      icon: createElement(CloudIcon, { fontSize: "small" }),
    },
  },
  kubernetesNamespace: {
    path: "/kubernetes/namespace/:namespace",
    component: K8sNamespaceDashboardPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "detail-panel",
    nav: {
      label: "Kubernetes Namespace",
      group: "Workspace",
      order: 32,
      showInSidebar: false,
      icon: createElement(CloudIcon, { fontSize: "small" }),
    },
  },
  kubernetesWorkload: {
    path: "/kubernetes/workload/:kind/:name",
    component: K8sWorkloadDashboardPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "detail-panel",
    nav: {
      label: "Kubernetes Workload",
      group: "Workspace",
      order: 33,
      showInSidebar: false,
      icon: createElement(CloudIcon, { fontSize: "small" }),
    },
  },
  kubernetesPod: {
    path: "/kubernetes/pod/:podName",
    component: K8sPodDashboardPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "detail-panel",
    nav: {
      label: "Kubernetes Pod",
      group: "Workspace",
      order: 34,
      showInSidebar: false,
      icon: createElement(CloudIcon, { fontSize: "small" }),
    },
  },
  hosts: {
    path: "/hosts",
    component: HostsPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Hosts",
      group: "Workspace",
      order: 40,
      showInSidebar: true,
      icon: createElement(DnsIcon, { fontSize: "small" }),
    },
  },
  hostsLinux: {
    path: "/hosts/linux",
    component: HostsLinuxPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Linux Hosts",
      group: "Workspace",
      order: 41,
      showInSidebar: false,
      icon: createElement(DnsIcon, { fontSize: "small" }),
    },
  },
  hostsWindows: {
    path: "/hosts/windows",
    component: HostsWindowsPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Windows Hosts",
      group: "Workspace",
      order: 42,
      showInSidebar: false,
      icon: createElement(DnsIcon, { fontSize: "small" }),
    },
  },
  hostsMacos: {
    path: "/hosts/macos",
    component: HostsMacosPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "macOS Hosts",
      group: "Workspace",
      order: 43,
      showInSidebar: false,
      icon: createElement(DnsIcon, { fontSize: "small" }),
    },
  },
  hostDetail: {
    path: "/hosts/:hostId",
    component: HostDetailPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "detail-panel",
    nav: {
      label: "Host Detail",
      group: "Workspace",
      order: 44,
      showInSidebar: false,
      icon: createElement(DnsIcon, { fontSize: "small" }),
    },
  },
  console: {
    path: "/console",
    component: ApiConsolePage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Console",
      group: "System",
      order: 50,
      showInSidebar: true,
      icon: createElement(TerminalIcon, { fontSize: "small" }),
    },
  },
  chat: {
    path: "/chat",
    component: ChatPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Chat",
      group: "Workspace",
      order: 60,
      showInSidebar: false,
      icon: createElement(ChatIcon, { fontSize: "small" }),
    },
  },
  clusterOverview: {
    path: "/cluster-overview",
    component: ClusterOverviewPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "cards",
    nav: {
      label: "Overview",
      group: "System",
      order: 10,
      showInSidebar: true,
      icon: createElement(InfoIcon, { fontSize: "small" }),
    },
  },
  clusterHealth: {
    path: "/cluster-health",
    component: ClusterHealthPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "cards",
    nav: {
      label: "Health",
      group: "System",
      order: 12,
      showInSidebar: true,
      icon: createElement(HealthAndSafetyIcon, { fontSize: "small" }),
    },
  },
  globalHealth: {
    path: "/health",
    component: GlobalHealthPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Global Health",
      group: "System",
      order: 11,
      showInSidebar: true,
      icon: createElement(HealthAndSafetyIcon, { fontSize: "small" }),
    },
  },
  clusterTasks: {
    path: "/cluster-tasks",
    component: TaskManagerPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Tasks",
      group: "System",
      order: 18,
      showInSidebar: true,
      icon: createElement(PendingActionsIcon, { fontSize: "small" }),
    },
  },
  clusterCapacity: {
    path: "/cluster-capacity",
    component: ClusterCapacityPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "cards",
    nav: {
      label: "Capacity",
      group: "System",
      order: 13,
      showInSidebar: false,
      icon: createElement(MemoryIcon, { fontSize: "small" }),
    },
  },
  clusterShards: {
    path: "/cluster-shards",
    component: ClusterShardsPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Shards",
      group: "System",
      order: 14,
      showInSidebar: false,
      icon: createElement(ViewModuleIcon, { fontSize: "small" }),
    },
  },
  clusterResilience: {
    path: "/cluster-resilience",
    component: ClusterResiliencePage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Resilience",
      group: "System",
      order: 17,
      showInSidebar: false,
      icon: createElement(ShieldIcon, { fontSize: "small" }),
    },
  },
  addData: {
    path: "/add-data",
    component: AddDataPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "list",
    nav: {
      label: "Add Data",
      group: "Data",
      order: 10,
      showInSidebar: true,
      icon: createElement(RocketLaunchIcon, { fontSize: "small" }),
    },
  },
  packageBuilder: {
    path: "/package-builder",
    component: PackageBuilderPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "list",
    nav: {
      label: "Package Builder",
      group: "System",
      order: 17,
      showInSidebar: false,
    },
  },
  dataStreams: {
    path: "/data-streams",
    component: DataStreamsPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Data Streams",
      group: "System",
      order: 23,
      showInSidebar: true,
      icon: createElement(DatasetIcon, { fontSize: "small" }),
    },
  },
  nodes: {
    path: "/nodes",
    component: NodesPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Nodes",
      group: "System",
      order: 20,
      showInSidebar: true,
      icon: createElement(MemoryIcon, { fontSize: "small" }),
    },
  },
  nodeDetail: {
    path: "/nodes/:nodeId",
    component: NodeDetailPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "detail-panel",
    nav: {
      label: "Node detail",
      group: "System",
      order: 24,
      showInSidebar: false,
      icon: createElement(MemoryIcon, { fontSize: "small" }),
    },
  },
  indices: {
    path: "/indices",
    component: IndicesPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Indices",
      group: "System",
      order: 25,
      showInSidebar: true,
      icon: createElement(StorageIcon, { fontSize: "small" }),
    },
  },
  storageExplorer: {
    path: "/storage-explorer",
    component: StorageExplorerPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Storage Explorer",
      group: "System",
      order: 27,
      showInSidebar: true,
      icon: createElement(StorageIcon, { fontSize: "small" }),
    },
  },
  ingestPipelines: {
    path: "/ingest-pipelines",
    component: IngestPipelinesPage,
    requiresConnection: true,
    requiredCapability: "canReadIngestPipelines",
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Ingest Pipelines",
      group: "System",
      order: 26,
      showInSidebar: true,
      icon: createElement(AccountTreeIcon, { fontSize: "small" }),
    },
  },
  clusterSettings: {
    path: "/cluster-settings",
    component: ClusterSettingsPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Cluster Settings",
      group: "System",
      order: 21,
      showInSidebar: true,
      icon: createElement(SettingsIcon, { fontSize: "small" }),
    },
  },
  nodesHotThreads: {
    path: "/nodes-hot-threads",
    component: NodesHotThreadsPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Hot Threads",
      group: "System",
      order: 28,
      showInSidebar: true,
      icon: createElement(SpeedIcon, { fontSize: "small" }),
    },
  },
  watcherGetWatch: {
    path: "/watcher-get-watch",
    component: WatcherGetWatchPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "detail-panel",
    nav: {
      label: "Watchers",
      group: "System",
      order: 29,
      showInSidebar: true,
      icon: createElement(PendingActionsIcon, { fontSize: "small" }),
    },
  },
  ilm: {
    path: "/ilm",
    component: IlmPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Index Lifecycle Management",
      group: "System",
      order: 31,
      showInSidebar: true,
      icon: createElement(PolicyIcon, { fontSize: "small" }),
    },
  },
  snapshots: {
    path: "/snapshots",
    component: SnapshotsPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Snapshots",
      group: "System",
      order: 32,
      showInSidebar: true,
      icon: createElement(BackupIcon, { fontSize: "small" }),
    },
  },
  templates: {
    path: "/templates",
    component: TemplatesPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Index Templates",
      group: "System",
      order: 22,
      showInSidebar: true,
      icon: createElement(DescriptionIcon, { fontSize: "small" }),
    },
  },
  fleet: {
    path: "/fleet",
    component: FleetPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "cards",
    nav: {
      label: "Fleet",
      group: "System",
      order: 15,
      showInSidebar: true,
      icon: createElement(SecurityIcon, { fontSize: "small" }),
    },
  },
  fleetAgentDetail: {
    path: "/fleet/agents/:agentId",
    component: FleetAgentPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "detail-panel",
    nav: {
      label: "Fleet Agent Detail",
      group: "System",
      order: 16,
      showInSidebar: false,
      icon: createElement(SecurityIcon, { fontSize: "small" }),
    },
  },
  investigate: {
    path: "/investigate",
    component: InvestigatePage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    nav: {
      label: "Investigate",
      group: "Security",
      order: 10,
      showInSidebar: true,
      icon: createElement(PolicyIcon, { fontSize: "small" }),
    },
  },
  users: {
    path: "/users",
    component: UsersPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    requiredCapability: "canReadSecurityUsers",
    nav: {
      label: "Users",
      group: "System",
      order: 30,
      showInSidebar: true,
      icon: createElement(PeopleIcon, { fontSize: "small" }),
    },
  },
  apiKeys: {
    path: "/api-keys",
    component: ApiKeysPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    requiredCapability: "canReadApiKeys",
    nav: {
      label: "API Keys",
      group: "System",
      order: 35,
      showInSidebar: true,
      icon: createElement(VpnKeyIcon, { fontSize: "small" }),
    },
  },
  roles: {
    path: "/roles",
    component: RolesPage,
    requiresConnection: true,
    showTimeControls: false,
    skeletonVariant: "table",
    requiredCapability: "canReadSecurityRoles",
    nav: {
      label: "Roles",
      group: "System",
      order: 40,
      showInSidebar: true,
      icon: createElement(AdminPanelSettingsIcon, { fontSize: "small" }),
    },
  },
  docs: {
    path: "/docs",
    component: DocsPage,
    requiresConnection: false,
    showTimeControls: false,
    nav: {
      label: "Docs",
      group: "Help",
      order: 10,
      showInSidebar: true,
      icon: createElement(MenuBookIcon, { fontSize: "small" }),
    },
  },
  settings: {
    path: "/settings",
    component: SettingsPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "LLM Settings",
      group: "Settings",
      order: 10,
      showInSidebar: false,
      icon: createElement(SettingsIcon, { fontSize: "small" }),
    },
  },
} as const satisfies Record<string, PageConfig>;

export type PageId = keyof typeof PAGE_MANIFEST;

/** Returns true when we positively know the user lacks a required capability. */
export function isHiddenByCapability(
  requiredCapability: keyof UserCapabilities | undefined,
  capabilities: UserCapabilities | null,
): boolean {
  if (!requiredCapability) return false;
  if (!capabilities) return false; // not yet fetched — keep visible
  return !capabilities[requiredCapability];
}

/** Sidebar section display order. Sections not listed here won't appear. */
export const NAV_SECTION_ORDER: NavGroup[] = ["Data", "Workspace", "Security", "System", "Help"];

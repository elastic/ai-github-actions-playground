import { type ComponentType, type ReactNode, createElement } from "react";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SearchIcon from "@mui/icons-material/Search";
import ExploreIcon from "@mui/icons-material/Explore";
import TimelineIcon from "@mui/icons-material/Timeline";
import TerminalIcon from "@mui/icons-material/Terminal";
import ChatIcon from "@mui/icons-material/Chat";
import InfoIcon from "@mui/icons-material/Info";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
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

import type { UserCapabilities } from "../services/es";
import ApiConsolePage from "../components/ApiConsolePage";
import ApiKeysPage from "../components/ApiKeysPage";
import ChatPage from "../components/ChatPage";
import ClusterCapacityPage from "../components/ClusterCapacityPage";
import ClusterHealthPage from "../components/ClusterHealthPage";
import ClusterOverviewPage from "../components/ClusterOverviewPage";
import ClusterResiliencePage from "../components/ClusterResiliencePage";
import ClusterShardsPage from "../components/ClusterShardsPage";
import ClusterTasksPage from "../components/ClusterTasksPage";
import DashboardsLandingPage from "../components/DashboardsLandingPage";
import DataStreamsPage from "../components/DataStreamsPage";
import AddDataPage from "../components/AddDataPage";
import DiscoverPage from "../components/DiscoverPage";
import DocsPage from "../components/DocsPage";
import ExplorePage from "../components/ExplorePage";
import FleetAgentPage from "../components/FleetAgentPage";
import FleetPage from "../components/FleetPage";
import IngestPipelinesPage from "../components/IngestPipelinesPage";
import IndicesPage from "../components/IndicesPage";
import RolesPage from "../components/RolesPage";
import SettingsPage from "../components/SettingsPage";
import TracesPage from "../components/traces/TracesPage";
import ProfilingPage from "../components/profiling/ProfilingPage";
import UsersPage from "../components/UsersPage";

export type NavGroup = "Workspace" | "System" | "Help" | "Settings";

export interface PageConfig {
  path: string;
  component: ComponentType;
  requiresConnection: boolean;
  showTimeControls: boolean;
  /** Key of `UserCapabilities` that must be `true` for the page to appear in the sidebar. */
  requiredCapability?: keyof UserCapabilities;
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
    nav: {
      label: "Query Lab",
      group: "Workspace",
      order: 20,
      showInSidebar: true,
      icon: createElement(SearchIcon, { fontSize: "small" }),
    },
  },
  explore: {
    path: "/explore",
    component: ExplorePage,
    requiresConnection: true,
    showTimeControls: true,
    nav: {
      label: "Metrics",
      group: "Workspace",
      order: 30,
      showInSidebar: true,
      icon: createElement(ExploreIcon, { fontSize: "small" }),
    },
  },
  traces: {
    path: "/traces",
    component: TracesPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Traces",
      group: "Workspace",
      order: 40,
      showInSidebar: true,
      icon: createElement(TimelineIcon, { fontSize: "small" }),
    },
  },
  profiling: {
    path: "/profiling",
    component: ProfilingPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Profiling",
      group: "Workspace",
      order: 45,
      showInSidebar: true,
      icon: createElement(SpeedIcon, { fontSize: "small" }),
    },
  },
  console: {
    path: "/console",
    component: ApiConsolePage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Console",
      group: "Workspace",
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
      showInSidebar: true,
      icon: createElement(ChatIcon, { fontSize: "small" }),
    },
  },
  clusterOverview: {
    path: "/cluster-overview",
    component: ClusterOverviewPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Cluster Overview",
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
    nav: {
      label: "Cluster Health",
      group: "System",
      order: 11,
      showInSidebar: true,
      icon: createElement(HealthAndSafetyIcon, { fontSize: "small" }),
    },
  },
  clusterTasks: {
    path: "/cluster-tasks",
    component: ClusterTasksPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Cluster Tasks",
      group: "System",
      order: 12,
      showInSidebar: false,
      icon: createElement(PendingActionsIcon, { fontSize: "small" }),
    },
  },
  clusterCapacity: {
    path: "/cluster-capacity",
    component: ClusterCapacityPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Cluster Capacity",
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
    nav: {
      label: "Cluster Shards",
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
    nav: {
      label: "Cluster Resilience",
      group: "System",
      order: 15.5,
      showInSidebar: false,
      icon: createElement(ShieldIcon, { fontSize: "small" }),
    },
  },
  addData: {
    path: "/add-data",
    component: AddDataPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Add Data",
      group: "System",
      order: 17,
      showInSidebar: true,
      icon: createElement(AddCircleOutlineIcon, { fontSize: "small" }),
    },
  },
  dataStreams: {
    path: "/data-streams",
    component: DataStreamsPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Data Streams",
      group: "System",
      order: 20,
      showInSidebar: true,
      icon: createElement(DatasetIcon, { fontSize: "small" }),
    },
  },
  indices: {
    path: "/indices",
    component: IndicesPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Indices",
      group: "System",
      order: 25,
      showInSidebar: true,
      icon: createElement(StorageIcon, { fontSize: "small" }),
    },
  },
  ingestPipelines: {
    path: "/ingest-pipelines",
    component: IngestPipelinesPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Ingest Pipelines",
      group: "System",
      order: 26,
      showInSidebar: true,
      icon: createElement(AccountTreeIcon, { fontSize: "small" }),
    },
  },
  fleet: {
    path: "/fleet",
    component: FleetPage,
    requiresConnection: true,
    showTimeControls: false,
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
    nav: {
      label: "Fleet Agent Detail",
      group: "System",
      order: 16,
      showInSidebar: false,
      icon: createElement(SecurityIcon, { fontSize: "small" }),
    },
  },
  users: {
    path: "/users",
    component: UsersPage,
    requiresConnection: true,
    showTimeControls: false,
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

/** Sidebar section display order. Sections not listed here won't appear. */
export const NAV_SECTION_ORDER: NavGroup[] = ["Workspace", "System", "Help"];

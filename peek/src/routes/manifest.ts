import { type ComponentType, type ReactNode, createElement } from "react";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SearchIcon from "@mui/icons-material/Search";
import ExploreIcon from "@mui/icons-material/Explore";
import TimelineIcon from "@mui/icons-material/Timeline";
import TerminalIcon from "@mui/icons-material/Terminal";
import ChatIcon from "@mui/icons-material/Chat";
import InfoIcon from "@mui/icons-material/Info";
import DatasetIcon from "@mui/icons-material/Dataset";
import PeopleIcon from "@mui/icons-material/People";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SettingsIcon from "@mui/icons-material/Settings";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";

import ApiConsolePage from "../components/ApiConsolePage";
import ChatPage from "../components/ChatPage";
import ClusterOverviewPage from "../components/ClusterOverviewPage";
import DashboardGrid from "../components/DashboardGrid";
import DashboardManagementPage from "../components/DashboardManagementPage";
import DataStreamsPage from "../components/DataStreamsPage";
import DiscoverPage from "../components/DiscoverPage";
import DocsPage from "../components/DocsPage";
import ExplorePage from "../components/ExplorePage";
import RolesPage from "../components/RolesPage";
import SettingsPage from "../components/SettingsPage";
import TracesPage from "../components/traces/TracesPage";
import UsersPage from "../components/UsersPage";

export type NavGroup = "Workspace" | "System" | "Help" | "Settings";

export interface PageConfig {
  path: string;
  component: ComponentType;
  requiresConnection: boolean;
  showTimeControls: boolean;
  nav: {
    label: string;
    group: NavGroup;
    order: number;
    showInSidebar: boolean;
    icon?: ReactNode;
  };
}

export const PAGE_MANIFEST = {
  dashboard: {
    path: "/",
    component: DashboardGrid,
    requiresConnection: true,
    showTimeControls: true,
    nav: {
      label: "Dashboard",
      group: "Workspace",
      order: 10,
      showInSidebar: true,
      icon: createElement(DashboardIcon, { fontSize: "small" }),
    },
  },
  dashboards: {
    path: "/dashboards",
    component: DashboardManagementPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Library",
      group: "Workspace",
      order: 15,
      showInSidebar: true,
      icon: createElement(DashboardCustomizeIcon, { fontSize: "small" }),
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
  users: {
    path: "/users",
    component: UsersPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Users",
      group: "System",
      order: 30,
      showInSidebar: true,
      icon: createElement(PeopleIcon, { fontSize: "small" }),
    },
  },
  roles: {
    path: "/roles",
    component: RolesPage,
    requiresConnection: true,
    showTimeControls: false,
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
  dashboardManagement: {
    path: "/dashboard-management",
    component: DashboardManagementPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: {
      label: "Dashboard Library",
      group: "Settings",
      order: 20,
      showInSidebar: false,
      icon: createElement(SettingsIcon, { fontSize: "small" }),
    },
  },
} as const satisfies Record<string, PageConfig>;

export type PageId = keyof typeof PAGE_MANIFEST;

/** Sidebar section display order. Sections not listed here won't appear. */
export const NAV_SECTION_ORDER: NavGroup[] = ["Workspace", "System", "Help"];

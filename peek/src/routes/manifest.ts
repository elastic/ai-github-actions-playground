import type { ComponentType } from "react";

import ApiConsolePage from "../components/ApiConsolePage";
import ChatPage from "../components/ChatPage";
import ClusterOverviewPage from "../components/ClusterOverviewPage";
import DashboardGrid from "../components/DashboardGrid";
import DashboardManagementPage from "../components/DashboardManagementPage";
import DataStreamsPage from "../components/DataStreamsPage";
import DiscoverPage from "../components/DiscoverPage";
import DocsPage from "../components/DocsPage";
import ExplorePage from "../components/ExplorePage";
import FleetAgentPage from "../components/FleetAgentPage";
import FleetPage from "../components/FleetPage";
import SettingsPage from "../components/SettingsPage";
import TracesPage from "../components/traces/TracesPage";

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
  };
}

export const PAGE_MANIFEST = {
  dashboard: {
    path: "/",
    component: DashboardGrid,
    requiresConnection: true,
    showTimeControls: true,
    nav: { label: "Dashboard", group: "Workspace", order: 10, showInSidebar: true },
  },
  discover: {
    path: "/discover",
    component: DiscoverPage,
    requiresConnection: true,
    showTimeControls: true,
    nav: { label: "Query Lab", group: "Workspace", order: 20, showInSidebar: true },
  },
  explore: {
    path: "/explore",
    component: ExplorePage,
    requiresConnection: true,
    showTimeControls: true,
    nav: { label: "Metrics", group: "Workspace", order: 30, showInSidebar: true },
  },
  traces: {
    path: "/traces",
    component: TracesPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: { label: "Traces", group: "Workspace", order: 40, showInSidebar: true },
  },
  console: {
    path: "/console",
    component: ApiConsolePage,
    requiresConnection: true,
    showTimeControls: false,
    nav: { label: "Console", group: "Workspace", order: 50, showInSidebar: true },
  },
  chat: {
    path: "/chat",
    component: ChatPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: { label: "Chat", group: "Workspace", order: 60, showInSidebar: true },
  },
  clusterOverview: {
    path: "/cluster-overview",
    component: ClusterOverviewPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: { label: "Cluster Overview", group: "System", order: 10, showInSidebar: true },
  },
  dataStreams: {
    path: "/data-streams",
    component: DataStreamsPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: { label: "Data Streams", group: "System", order: 20, showInSidebar: true },
  },
  fleet: {
    path: "/fleet",
    component: FleetPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: { label: "Fleet", group: "System", order: 15, showInSidebar: true },
  },
  fleetAgentDetail: {
    path: "/fleet/agents/:agentId",
    component: FleetAgentPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: { label: "Fleet Agent Detail", group: "System", order: 16, showInSidebar: false },
  },
  docs: {
    path: "/docs",
    component: DocsPage,
    requiresConnection: false,
    showTimeControls: false,
    nav: { label: "Docs", group: "Help", order: 10, showInSidebar: true },
  },
  settings: {
    path: "/settings",
    component: SettingsPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: { label: "LLM Settings", group: "Settings", order: 10, showInSidebar: false },
  },
  dashboardManagement: {
    path: "/dashboard-management",
    component: DashboardManagementPage,
    requiresConnection: true,
    showTimeControls: false,
    nav: { label: "Dashboard Management", group: "Settings", order: 20, showInSidebar: false },
  },
} as const satisfies Record<string, PageConfig>;

export type PageId = keyof typeof PAGE_MANIFEST;

/** Sidebar section display order. Sections not listed here won't appear. */
export const NAV_SECTION_ORDER: NavGroup[] = ["Workspace", "System", "Help"];

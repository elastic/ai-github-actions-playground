import { create } from "zustand";

import type {
  FleetServerStatusMetrics,
  FleetAgentVersionCount,
  FleetOutputHealth,
  ElasticAgentInfo,
  FleetAction,
  FleetActionResult,
} from "../services/fleet";

export type FleetViewTab = "overview" | "agents" | "outputs" | "activity";

export interface AgentFilter {
  search: string;
  version: string | null;
  hasErrors: boolean;
  staleness: "stale" | "critical" | null;
}

interface FleetState {
  /** Aggregate status from metrics-fleet_server.agent_status-* */
  serverStatus: FleetServerStatusMetrics | null;
  /** Version distribution from metrics-fleet_server.agent_versions-* */
  agentVersions: FleetAgentVersionCount[];
  /** Output health from logs-fleet_server.output_health-* */
  outputHealth: FleetOutputHealth[];
  /** Agent inventory from logs-elastic_agent-* aggregation */
  agentInventory: ElasticAgentInfo[];
  /** Uncapped agent inventory total from logs-elastic_agent-* cardinality aggregation */
  agentInventoryTotal: number;
  /** Fleet actions from fleet-actions-sim */
  actions: FleetAction[];
  /** Fleet action results from fleet-actions-results-sim */
  actionResults: FleetActionResult[];
  /** Whether Fleet auto-refresh is enabled */
  autoRefreshEnabled: boolean;
  /** Timestamp of last successful refresh in milliseconds */
  lastUpdatedAt: number | null;

  /** Currently active tab */
  activeTab: FleetViewTab;
  /** Agent table filter state */
  agentFilter: AgentFilter;

  /** Top-level loading flag */
  loading: boolean;
  /** Top-level error */
  error: string | null;
  /** Errors from individual data sources that didn't block the whole load */
  partialErrors: string[];

  setServerStatus: (status: FleetServerStatusMetrics | null) => void;
  setAgentVersions: (versions: FleetAgentVersionCount[]) => void;
  setOutputHealth: (health: FleetOutputHealth[]) => void;
  setAgentInventory: (agents: ElasticAgentInfo[]) => void;
  setAgentInventoryTotal: (total: number) => void;
  setActions: (actions: FleetAction[]) => void;
  setActionResults: (results: FleetActionResult[]) => void;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  setLastUpdatedAt: (timestamp: number | null) => void;
  setActiveTab: (tab: FleetViewTab) => void;
  updateAgentFilter: (updates: Partial<AgentFilter>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPartialErrors: (errors: string[]) => void;
  resetFilters: () => void;
}

const DEFAULT_FILTER: AgentFilter = {
  search: "",
  version: null,
  hasErrors: false,
  staleness: null,
};

export const useFleetStore = create<FleetState>()((set) => ({
  serverStatus: null,
  agentVersions: [],
  outputHealth: [],
  agentInventory: [],
  agentInventoryTotal: 0,
  actions: [],
  actionResults: [],
  autoRefreshEnabled: true,
  lastUpdatedAt: null,

  activeTab: "overview",
  agentFilter: { ...DEFAULT_FILTER },

  loading: false,
  error: null,
  partialErrors: [],

  setServerStatus: (status) => set({ serverStatus: status }),
  setAgentVersions: (versions) => set({ agentVersions: versions }),
  setOutputHealth: (health) => set({ outputHealth: health }),
  setAgentInventory: (agents) => set({ agentInventory: agents }),
  setAgentInventoryTotal: (total) => set({ agentInventoryTotal: total }),
  setActions: (actions) => set({ actions }),
  setActionResults: (results) => set({ actionResults: results }),
  setAutoRefreshEnabled: (enabled) => set({ autoRefreshEnabled: enabled }),
  setLastUpdatedAt: (timestamp) => set({ lastUpdatedAt: timestamp }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  updateAgentFilter: (updates) => set((s) => ({ agentFilter: { ...s.agentFilter, ...updates } })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setPartialErrors: (errors) => set({ partialErrors: errors }),
  resetFilters: () =>
    set({ agentFilter: { ...DEFAULT_FILTER }, autoRefreshEnabled: true, lastUpdatedAt: null }),
}));

import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type FleetViewTab = "overview" | "agents" | "outputs" | "activity";

export interface AgentFilter {
  search: string;
  version: string | null;
  hasErrors: boolean;
  staleness: "stale" | "critical" | null;
}

interface FleetState {
  /** Whether Fleet auto-refresh is enabled */
  autoRefreshEnabled: boolean;

  /** Currently active tab */
  activeTab: FleetViewTab;
  /** Agent table filter state */
  agentFilter: AgentFilter;

  setAutoRefreshEnabled: (enabled: boolean) => void;
  setActiveTab: (tab: FleetViewTab) => void;
  updateAgentFilter: (updates: Partial<AgentFilter>) => void;
  resetFilters: () => void;
}

const DEFAULT_FILTER: AgentFilter = {
  search: "",
  version: null,
  hasErrors: false,
  staleness: null,
};

export const useFleetStore = create<FleetState>()(
  devtools(
    (set) => ({
      autoRefreshEnabled: true,

      activeTab: "overview",
      agentFilter: { ...DEFAULT_FILTER },

      setAutoRefreshEnabled: (enabled) => set({ autoRefreshEnabled: enabled }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      updateAgentFilter: (updates) =>
        set((s) => ({ agentFilter: { ...s.agentFilter, ...updates } })),
      resetFilters: () => set({ agentFilter: { ...DEFAULT_FILTER } }),
    }),
    { name: "FleetStore", enabled: import.meta.env.DEV },
  ),
);

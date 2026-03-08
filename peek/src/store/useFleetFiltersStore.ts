/**
 * Fleet domain filter store.
 *
 * Owns all fleet-related filter state: auto-refresh, active tab, agent filters.
 * Extracted from the former monolithic usePageFiltersStore so that Fleet changes
 * don't create merge-conflict hotspots with other observability domains.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { registerResetter } from "./resetRegistry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FleetViewTab = "overview" | "agents" | "outputs" | "activity";

export interface AgentFilter {
  search: string;
  version: string | null;
  hasErrors: boolean;
  staleness: "stale" | "critical" | null;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_AGENT_FILTER: AgentFilter = {
  search: "",
  version: null,
  hasErrors: false,
  staleness: null,
};

const DEFAULT_FLEET_FILTERS = {
  fleetAutoRefreshEnabled: true,
  fleetActiveTab: "overview" as FleetViewTab,
};

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface FleetFiltersState {
  fleetAutoRefreshEnabled: boolean;
  fleetActiveTab: FleetViewTab;
  agentFilter: AgentFilter;
  setFleetAutoRefreshEnabled: (enabled: boolean) => void;
  setFleetActiveTab: (tab: FleetViewTab) => void;
  updateAgentFilter: (updates: Partial<AgentFilter>) => void;
  resetFleetAgentFilter: () => void;
  resetFleetFilters: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFleetFiltersStore = create<FleetFiltersState>()(
  devtools(
    (set) => ({
      ...DEFAULT_FLEET_FILTERS,
      agentFilter: { ...DEFAULT_AGENT_FILTER },
      setFleetAutoRefreshEnabled: (enabled) => set({ fleetAutoRefreshEnabled: enabled }),
      setFleetActiveTab: (tab) => set({ fleetActiveTab: tab }),
      updateAgentFilter: (updates) =>
        set((s) => ({ agentFilter: { ...s.agentFilter, ...updates } })),
      resetFleetAgentFilter: () => set({ agentFilter: { ...DEFAULT_AGENT_FILTER } }),
      resetFleetFilters: () =>
        set({
          ...DEFAULT_FLEET_FILTERS,
          agentFilter: { ...DEFAULT_AGENT_FILTER },
        }),
    }),
    { name: "FleetFiltersStore", enabled: import.meta.env.DEV },
  ),
);

// ---------------------------------------------------------------------------
// Self-register resetter
// ---------------------------------------------------------------------------

registerResetter("fleet", () => useFleetFiltersStore.getState().resetFleetFilters());

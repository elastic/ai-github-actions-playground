/**
 * Consolidated page-level filter store.
 *
 * Merges the former useServicesStore, useProfilingStore, and useFleetStore into
 * a single Zustand store.  Each section is independent – pages select only the
 * slice they need, so unrelated filter changes never trigger re-renders.
 *
 * Dashboard stores and the connection store are intentionally kept separate
 * because they carry significantly more logic.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import {
  DEFAULT_SERVICE_INVENTORY_FILTERS,
  EMPTY_PROFILING_FILTERS,
  type ProfilingFilters,
  type ServiceInventoryFilters,
} from "../types/pageFilters";

// ---------------------------------------------------------------------------
// Re-exported types that consumers previously imported from individual stores
// ---------------------------------------------------------------------------

export type ProfilingViewMode =
  | "topFunctions"
  | "stacktraces"
  | "timeline"
  | "flamegraph"
  | "flamescope";

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

interface PageFiltersState {
  // --- Services ---------------------------------------------------------
  serviceFilters: ServiceInventoryFilters;
  serviceSearchSession: number;
  updateServiceFilters: (updates: Partial<ServiceInventoryFilters>) => void;
  resetServiceFilters: () => void;

  // --- Profiling --------------------------------------------------------
  profilingFilters: ProfilingFilters;
  profilingRawQuery: string | null;
  profilingViewMode: ProfilingViewMode;
  expandedStacktraceIds: Set<string>;
  updateProfilingFilters: (updates: Partial<ProfilingFilters>) => void;
  setProfilingRawQuery: (query: string | null) => void;
  setProfilingViewMode: (mode: ProfilingViewMode) => void;
  toggleExpandedStacktraceId: (id: string) => void;
  resetProfilingFilters: () => void;

  // --- Fleet ------------------------------------------------------------
  fleetAutoRefreshEnabled: boolean;
  fleetActiveTab: FleetViewTab;
  agentFilter: AgentFilter;
  setFleetAutoRefreshEnabled: (enabled: boolean) => void;
  setFleetActiveTab: (tab: FleetViewTab) => void;
  updateAgentFilter: (updates: Partial<AgentFilter>) => void;
  resetFleetFilters: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePageFiltersStore = create<PageFiltersState>()(
  devtools(
    (set) => ({
      // --- Services -------------------------------------------------------
      serviceFilters: { ...DEFAULT_SERVICE_INVENTORY_FILTERS },
      serviceSearchSession: 0,
      updateServiceFilters: (updates) =>
        set((s) => ({ serviceFilters: { ...s.serviceFilters, ...updates } })),
      resetServiceFilters: () =>
        set((s) => ({
          serviceFilters: { ...DEFAULT_SERVICE_INVENTORY_FILTERS },
          serviceSearchSession: s.serviceSearchSession + 1,
        })),

      // --- Profiling ------------------------------------------------------
      profilingFilters: { ...EMPTY_PROFILING_FILTERS },
      profilingRawQuery: null,
      profilingViewMode: "topFunctions" as ProfilingViewMode,
      expandedStacktraceIds: new Set<string>(),
      updateProfilingFilters: (updates) =>
        set((s) => ({
          profilingFilters: { ...s.profilingFilters, ...updates },
          profilingRawQuery: null,
        })),
      setProfilingRawQuery: (query) => set({ profilingRawQuery: query }),
      setProfilingViewMode: (mode) => set({ profilingViewMode: mode, profilingRawQuery: null }),
      toggleExpandedStacktraceId: (id) =>
        set((s) => {
          const next = new Set(s.expandedStacktraceIds);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return { expandedStacktraceIds: next };
        }),
      resetProfilingFilters: () =>
        set({
          profilingFilters: { ...EMPTY_PROFILING_FILTERS },
          profilingRawQuery: null,
          profilingViewMode: "topFunctions" as ProfilingViewMode,
          expandedStacktraceIds: new Set<string>(),
        }),

      // --- Fleet ----------------------------------------------------------
      ...DEFAULT_FLEET_FILTERS,
      agentFilter: { ...DEFAULT_AGENT_FILTER },
      setFleetAutoRefreshEnabled: (enabled) => set({ fleetAutoRefreshEnabled: enabled }),
      setFleetActiveTab: (tab) => set({ fleetActiveTab: tab }),
      updateAgentFilter: (updates) =>
        set((s) => ({ agentFilter: { ...s.agentFilter, ...updates } })),
      resetFleetFilters: () =>
        set({
          ...DEFAULT_FLEET_FILTERS,
          agentFilter: { ...DEFAULT_AGENT_FILTER },
        }),
    }),
    { name: "PageFiltersStore", enabled: import.meta.env.DEV },
  ),
);

/**
 * Hosts domain filter store.
 *
 * Owns all Hosts-related filter state.  Extracted from the former monolithic
 * usePageFiltersStore so that Hosts changes don't create merge-conflict
 * hotspots with other observability domains.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { DEFAULT_HOSTS_FILTERS, type HostsFilters } from "../types/pageFilters";
import { registerResetter } from "./resetRegistry";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface HostsFiltersState {
  hostsFilters: HostsFilters;
  updateHostsFilters: (updates: Partial<HostsFilters>) => void;
  resetHostsFilters: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useHostsFiltersStore = create<HostsFiltersState>()(
  devtools(
    (set) => ({
      hostsFilters: { ...DEFAULT_HOSTS_FILTERS },
      updateHostsFilters: (updates) =>
        set((s) => ({ hostsFilters: { ...s.hostsFilters, ...updates } })),
      resetHostsFilters: () => set({ hostsFilters: { ...DEFAULT_HOSTS_FILTERS } }),
    }),
    { name: "HostsFiltersStore", enabled: import.meta.env.DEV },
  ),
);

// ---------------------------------------------------------------------------
// Self-register resetter
// ---------------------------------------------------------------------------

registerResetter("hosts", () => useHostsFiltersStore.getState().resetHostsFilters());

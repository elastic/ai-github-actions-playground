/**
 * Service domain filter store.
 *
 * Owns all service-inventory-related filter state.  Extracted from the former
 * monolithic usePageFiltersStore so that Services changes don't create
 * merge-conflict hotspots with other observability domains.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import {
  DEFAULT_SERVICE_INVENTORY_FILTERS,
  type ServiceInventoryFilters,
} from "../types/pageFilters";
import { registerResetter } from "./resetRegistry";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface ServiceFiltersState {
  serviceFilters: ServiceInventoryFilters;
  serviceSearchSession: number;
  updateServiceFilters: (updates: Partial<ServiceInventoryFilters>) => void;
  resetServiceFilters: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useServiceFiltersStore = create<ServiceFiltersState>()(
  devtools(
    (set) => ({
      serviceFilters: { ...DEFAULT_SERVICE_INVENTORY_FILTERS },
      serviceSearchSession: 0,
      updateServiceFilters: (updates) =>
        set((s) => ({ serviceFilters: { ...s.serviceFilters, ...updates } })),
      resetServiceFilters: () =>
        set((s) => ({
          serviceFilters: { ...DEFAULT_SERVICE_INVENTORY_FILTERS },
          serviceSearchSession: s.serviceSearchSession + 1,
        })),
    }),
    { name: "ServiceFiltersStore", enabled: import.meta.env.DEV },
  ),
);

// ---------------------------------------------------------------------------
// Self-register resetter
// ---------------------------------------------------------------------------

registerResetter("services", () => useServiceFiltersStore.getState().resetServiceFilters());

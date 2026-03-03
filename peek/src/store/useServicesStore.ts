import { create } from "zustand";
import { devtools } from "zustand/middleware";

import type { ServiceInventoryFilters } from "../components/services/serviceInventoryQueryBuilder";
import { DEFAULT_SERVICE_INVENTORY_FILTERS } from "../components/services/serviceInventoryQueryBuilder";

interface ServicesState {
  /** Time-range filters for service inventory */
  filters: ServiceInventoryFilters;

  updateFilters: (updates: Partial<ServiceInventoryFilters>) => void;
  resetFilters: () => void;
}

const getInitialState = () => ({
  filters: { ...DEFAULT_SERVICE_INVENTORY_FILTERS },
});

export const useServicesStore = create<ServicesState>()(
  devtools(
    (set) => ({
      ...getInitialState(),

      updateFilters: (updates) => set((s) => ({ filters: { ...s.filters, ...updates } })),
      resetFilters: () => set(getInitialState()),
    }),
    { name: "ServicesStore", enabled: import.meta.env.DEV },
  ),
);

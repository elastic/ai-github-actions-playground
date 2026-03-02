import { create } from "zustand";
import { devtools } from "zustand/middleware";

import type { EsqlResponse } from "../types";
import type { ServiceInventoryFilters } from "../components/services/serviceInventoryQueryBuilder";
import { DEFAULT_SERVICE_INVENTORY_FILTERS } from "../components/services/serviceInventoryQueryBuilder";

interface ServicesState {
  /** Time-range filters for service inventory */
  filters: ServiceInventoryFilters;
  /** Cached query results */
  searchResult: EsqlResponse | null;

  updateFilters: (updates: Partial<ServiceInventoryFilters>) => void;
  setSearchResult: (result: EsqlResponse | null) => void;
  resetFilters: () => void;
}

const getInitialState = () => ({
  filters: { ...DEFAULT_SERVICE_INVENTORY_FILTERS },
  searchResult: null as EsqlResponse | null,
});

export const useServicesStore = create<ServicesState>()(
  devtools(
    (set) => ({
      ...getInitialState(),

      updateFilters: (updates) => set((s) => ({ filters: { ...s.filters, ...updates } })),
      setSearchResult: (result) => set({ searchResult: result }),
      resetFilters: () => set(getInitialState()),
    }),
    { name: "ServicesStore", enabled: import.meta.env.DEV },
  ),
);

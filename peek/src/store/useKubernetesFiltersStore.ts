/**
 * Kubernetes domain filter store.
 *
 * Owns all Kubernetes-related filter state.  Extracted from the former
 * monolithic usePageFiltersStore so that Kubernetes changes don't create
 * merge-conflict hotspots with other observability domains.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { DEFAULT_KUBERNETES_FILTERS, type KubernetesFilters } from "../types/pageFilters";
import { registerResetter } from "./resetRegistry";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface KubernetesFiltersState {
  kubernetesFilters: KubernetesFilters;
  updateKubernetesFilters: (updates: Partial<KubernetesFilters>) => void;
  resetKubernetesFilters: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useKubernetesFiltersStore = create<KubernetesFiltersState>()(
  devtools(
    (set) => ({
      kubernetesFilters: { ...DEFAULT_KUBERNETES_FILTERS },
      updateKubernetesFilters: (updates) =>
        set((s) => ({ kubernetesFilters: { ...s.kubernetesFilters, ...updates } })),
      resetKubernetesFilters: () => set({ kubernetesFilters: { ...DEFAULT_KUBERNETES_FILTERS } }),
    }),
    { name: "KubernetesFiltersStore", enabled: import.meta.env.DEV },
  ),
);

// ---------------------------------------------------------------------------
// Self-register resetter
// ---------------------------------------------------------------------------

registerResetter("kubernetes", () => useKubernetesFiltersStore.getState().resetKubernetesFilters());

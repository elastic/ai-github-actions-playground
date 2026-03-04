// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

import { storeResetters } from "../../src/store/storeResetters";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { useExplorerStore } from "../../src/store/useExplorerStore";
import { usePageFiltersStore } from "../../src/store/usePageFiltersStore";
import { useLLMStore } from "../../src/store/useLLMStore";
import { useQueryStore } from "../../src/store/useQueryStore";
import { useTracesStore } from "../../src/store/useTracesStore";
import { useUIStore } from "../../src/store/useUIStore";
import { useThemeStore } from "../../src/store/useThemeStore";
import { useCommandPaletteStore } from "../../src/store/useCommandPaletteStore";
import { useSearchPanelUIStore } from "../../src/store/useSearchPanelUIStore";
import { useApiConsoleStore } from "../../src/store/useApiConsoleStore";
import { usePageContextStore } from "../../src/store/usePageContextStore";
import { useLogsStore } from "../../src/store/useLogsStore";

/**
 * Each entry pairs a store's display name with the reset method name it exposes.
 * If a store grows a new reset method or a new store is added, update this table
 * and ensure the corresponding resetter is present in storeResetters.ts.
 */
const STORES_WITH_RESET_API = [
  { name: "useConnectionStore", store: useConnectionStore, method: "resetConnectionState" },
  { name: "useDashboardStore", store: useDashboardStore, method: "resetDashboardState" },
  { name: "useExplorerStore", store: useExplorerStore, method: "reset" },
  { name: "usePageFiltersStore (fleet)", store: usePageFiltersStore, method: "resetFleetFilters" },
  {
    name: "usePageFiltersStore (kubernetes)",
    store: usePageFiltersStore,
    method: "resetKubernetesFilters",
  },
  { name: "useLLMStore", store: useLLMStore, method: "resetLLMState" },
  {
    name: "usePageFiltersStore (profiling)",
    store: usePageFiltersStore,
    method: "resetProfilingFilters",
  },
  { name: "useQueryStore", store: useQueryStore, method: "resetQueryState" },
  {
    name: "usePageFiltersStore (services)",
    store: usePageFiltersStore,
    method: "resetServiceFilters",
  },
  { name: "useTracesStore", store: useTracesStore, method: "resetFilters" },
  { name: "useUIStore", store: useUIStore, method: "resetUIState" },
  { name: "useThemeStore", store: useThemeStore, method: "resetThemeState" },
  {
    name: "useCommandPaletteStore",
    store: useCommandPaletteStore,
    method: "resetCommandPaletteState",
  },
  {
    name: "useSearchPanelUIStore",
    store: useSearchPanelUIStore,
    method: "resetSearchPanelUIState",
  },
  { name: "useApiConsoleStore", store: useApiConsoleStore, method: "resetApiConsoleState" },
  { name: "usePageContextStore", store: usePageContextStore, method: "resetPageContext" },
  { name: "useLogsStore", store: useLogsStore, method: "reset" },
] as const;

describe("storeResetters registry", () => {
  it("contains one resetter for every store that exposes a reset API", () => {
    expect(storeResetters).toHaveLength(STORES_WITH_RESET_API.length);
  });

  describe("invoking storeResetters calls each store's reset method", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    for (const { name, store, method } of STORES_WITH_RESET_API) {
      it(`calls ${name}.${method}`, () => {
        const state = store.getState() as Record<string, () => void>;
        const spy = vi.spyOn(state, method).mockImplementation(() => {});
        for (const reset of storeResetters) {
          reset();
        }
        expect(spy).toHaveBeenCalledOnce();
      });
    }
  });
});

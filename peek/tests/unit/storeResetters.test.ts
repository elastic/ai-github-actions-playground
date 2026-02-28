import { describe, it, expect, vi, beforeEach } from "vitest";

import { storeResetters } from "../../src/store/storeResetters";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { useExplorerStore } from "../../src/store/useExplorerStore";
import { useFleetStore } from "../../src/store/useFleetStore";
import { useLLMStore } from "../../src/store/useLLMStore";
import { useProfilingStore } from "../../src/store/useProfilingStore";
import { useQueryStore } from "../../src/store/useQueryStore";
import { useTracesStore } from "../../src/store/useTracesStore";
import { useUIStore } from "../../src/store/useUIStore";
import { useApiConsoleStore } from "../../src/store/useApiConsoleStore";

/**
 * Each entry pairs a store's display name with the reset method name it exposes.
 * If a store grows a new reset method or a new store is added, update this table
 * and ensure the corresponding resetter is present in storeResetters.ts.
 */
const STORES_WITH_RESET_API = [
  { name: "useConnectionStore", store: useConnectionStore, method: "resetConnectionState" },
  { name: "useDashboardStore", store: useDashboardStore, method: "resetDashboardState" },
  { name: "useExplorerStore", store: useExplorerStore, method: "reset" },
  { name: "useFleetStore", store: useFleetStore, method: "resetFilters" },
  { name: "useLLMStore", store: useLLMStore, method: "resetLLMState" },
  { name: "useProfilingStore", store: useProfilingStore, method: "resetFilters" },
  { name: "useQueryStore", store: useQueryStore, method: "resetQueryState" },
  { name: "useTracesStore", store: useTracesStore, method: "resetFilters" },
  { name: "useUIStore", store: useUIStore, method: "resetUIState" },
  { name: "useApiConsoleStore", store: useApiConsoleStore, method: "resetApiConsoleState" },
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

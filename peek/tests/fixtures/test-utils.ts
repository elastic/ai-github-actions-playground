import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useUIStore } from "../../src/store/useUIStore";
import { useQueryStore } from "../../src/store/useQueryStore";
import { useDashboardStore } from "../../src/store/useDashboardStore";

/** Reset all domain stores — use in test `beforeEach` blocks. */
export function resetAllStores() {
  useConnectionStore.getState().resetConnectionState();
  useUIStore.getState().resetUIState();
  useQueryStore.getState().resetQueryState();
  useDashboardStore.getState().resetDashboardState();
}

export function makeStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
}

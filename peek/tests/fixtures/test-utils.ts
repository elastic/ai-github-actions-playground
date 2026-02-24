import { storeResetters } from "../../src/store/storeResetters";

/** Reset all domain stores — use in test `beforeEach` blocks. */
export function resetAllStores() {
  for (const reset of storeResetters) {
    reset();
  }
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

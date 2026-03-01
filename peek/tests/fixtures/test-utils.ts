import { storeResetters } from "../../src/store/storeResetters";

/** Reset all domain stores — use in test `beforeEach` blocks. */
export function resetAllStores() {
  for (const reset of storeResetters) {
    reset();
  }
}

/** Create an in-memory Storage mock compatible with the Web Storage API. */
export function makeStorageMock(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

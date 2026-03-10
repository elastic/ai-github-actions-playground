import { getRegisteredResetters } from "../../src/store/resetRegistry";

/**
 * Reset all domain stores — use in test `beforeEach` blocks.
 *
 * Uses the reset registry so that only stores actually imported by the
 * current test are reset.  This keeps vitest's `--related` dependency
 * graph tight: test-utils → resetRegistry (no fan-out to every store).
 */
export function resetAllStores() {
  for (const reset of getRegisteredResetters()) {
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

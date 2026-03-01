import { storeResetters } from "../../src/store/storeResetters";

/** Reset all domain stores — use in test `beforeEach` blocks. */
export function resetAllStores() {
  for (const reset of storeResetters) {
    reset();
  }
}

import { useCallback } from "react";

import { storeResetters } from "../store/storeResetters";

export function useResetAllStores() {
  return useCallback(() => {
    for (const reset of storeResetters) {
      reset();
    }
  }, []);
}

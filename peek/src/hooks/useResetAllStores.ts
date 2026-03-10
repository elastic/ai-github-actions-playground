import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { storeResetters } from "../store/storeResetters";

export function useResetAllStores() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    for (const reset of storeResetters) {
      reset();
    }
    queryClient.removeQueries({ queryKey: ["discover-result"], exact: true });
  }, [queryClient]);
}

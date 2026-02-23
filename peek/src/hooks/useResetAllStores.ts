import { useCallback } from "react";

import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { useQueryStore } from "../store/useQueryStore";
import { useDashboardStore } from "../store/useDashboardStore";

export function useResetAllStores() {
  return useCallback(() => {
    useConnectionStore.getState().resetConnectionState();
    useUIStore.getState().resetUIState();
    useQueryStore.getState().resetQueryState();
    useDashboardStore.getState().resetDashboardState();
  }, []);
}

/**
 * Shared registry of all Zustand store reset functions.
 *
 * Every store that exposes a reset API must register its resetter here so that
 * both `useResetAllStores` (runtime) and `resetAllStores` (tests) call a single
 * authoritative list instead of maintaining separate hard-coded copies.
 *
 * When adding a new store with a reset method, add its resetter to this array.
 */

import { useConnectionStore } from "./useConnectionStore";
import { useDashboardStore } from "./useDashboardStore";
import { useExplorerStore } from "./useExplorerStore";
import { useFleetStore } from "./useFleetStore";
import { useLLMStore } from "./useLLMStore";
import { useQueryStore } from "./useQueryStore";
import { useTracesStore } from "./useTracesStore";
import { useUIStore } from "./useUIStore";

export const storeResetters: ReadonlyArray<() => void> = [
  () => useConnectionStore.getState().resetConnectionState(),
  () => useDashboardStore.getState().resetDashboardState(),
  () => useExplorerStore.getState().reset(),
  () => useFleetStore.getState().resetFilters(),
  () => useLLMStore.getState().resetLLMState(),
  () => useQueryStore.getState().resetQueryState(),
  () => useTracesStore.getState().resetFilters(),
  () => useUIStore.getState().resetUIState(),
];

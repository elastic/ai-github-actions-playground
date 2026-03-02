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
import { useProfilingStore } from "./useProfilingStore";
import { useQueryStore } from "./useQueryStore";
import { useTracesStore } from "./useTracesStore";
import { useUIStore } from "./useUIStore";
import { useApiConsoleStore } from "./useApiConsoleStore";

export const RESET_SCOPE: ReadonlyArray<{ label: string; reset: () => void }> = [
  {
    label: "Connection settings and credentials",
    reset: () => useConnectionStore.getState().resetConnectionState(),
  },
  {
    label: "Dashboard layouts and state",
    reset: () => useDashboardStore.getState().resetDashboardState(),
  },
  {
    label: "Query Lab filters and queries",
    reset: () => useQueryStore.getState().resetQueryState(),
  },
  {
    label: "Traces, metrics, and fleet filters",
    reset: () => {
      useTracesStore.getState().resetFilters();
      useExplorerStore.getState().reset();
      useFleetStore.getState().resetFilters();
      useProfilingStore.getState().resetFilters();
    },
  },
  {
    label: "LLM and AI assistant configuration",
    reset: () => useLLMStore.getState().resetLLMState(),
  },
  {
    label: "UI preferences (theme, panel state)",
    reset: () => useUIStore.getState().resetUIState(),
  },
  {
    label: "Console history and request state",
    reset: () => useApiConsoleStore.getState().resetApiConsoleState(),
  },
];

export const storeResetters: ReadonlyArray<() => void> = RESET_SCOPE.map((item) => item.reset);

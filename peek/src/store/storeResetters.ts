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
import { useServicesStore } from "./useServicesStore";
import { useTracesStore } from "./useTracesStore";
import { useUIStore } from "./useUIStore";
import { useApiConsoleStore } from "./useApiConsoleStore";
import { usePageContextStore } from "./usePageContextStore";
import { useLogsStore } from "./useLogsStore";

const resetConnection = () => useConnectionStore.getState().resetConnectionState();
const resetDashboard = () => useDashboardStore.getState().resetDashboardState();
const resetExplorer = () => useExplorerStore.getState().reset();
const resetFleet = () => useFleetStore.getState().resetFilters();
const resetLlm = () => useLLMStore.getState().resetLLMState();
const resetProfiling = () => useProfilingStore.getState().resetFilters();
const resetQuery = () => useQueryStore.getState().resetQueryState();
const resetServices = () => useServicesStore.getState().resetFilters();
const resetTraces = () => useTracesStore.getState().resetFilters();
const resetUi = () => useUIStore.getState().resetUIState();
const resetApiConsole = () => useApiConsoleStore.getState().resetApiConsoleState();
const resetPageContext = () => usePageContextStore.getState().resetPageContext();
const resetLogs = () => useLogsStore.getState().reset();

export const storeResetters: ReadonlyArray<() => void> = [
  resetConnection,
  resetDashboard,
  resetExplorer,
  resetFleet,
  resetLlm,
  resetProfiling,
  resetQuery,
  resetServices,
  resetTraces,
  resetLogs,
  resetUi,
  resetApiConsole,
  resetPageContext,
  resetLogs,
];

export const RESET_SCOPE: ReadonlyArray<{ label: string; reset: () => void }> = [
  {
    label: "Connection settings and credentials",
    reset: resetConnection,
  },
  {
    label: "Dashboard layouts and state",
    reset: resetDashboard,
  },
  {
    label: "Query Lab filters and queries",
    reset: resetQuery,
  },
  {
    label: "Observability filters (traces, metrics, logs, fleet, profiling, services)",
    reset: () => {
      resetTraces();
      resetExplorer();
      resetLogs();
      resetFleet();
      resetProfiling();
      resetServices();
    },
  },
  {
    label: "LLM and AI assistant configuration",
    reset: resetLlm,
  },
  {
    label: "UI preferences (theme, panel state)",
    reset: resetUi,
  },
  {
    label: "Console history and request state",
    reset: resetApiConsole,
  },
];

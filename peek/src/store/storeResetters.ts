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
import { usePageFiltersStore } from "./usePageFiltersStore";
import { useLLMStore } from "./useLLMStore";
import { useQueryStore } from "./useQueryStore";
import { useTracesStore } from "./useTracesStore";
import { useUIStore } from "./useUIStore";
import { useThemeStore } from "./useThemeStore";
import { useCommandPaletteStore } from "./useCommandPaletteStore";
import { useSearchPanelUIStore } from "./useSearchPanelUIStore";
import { useApiConsoleStore } from "./useApiConsoleStore";
import { usePageContextStore } from "./usePageContextStore";
import { useLogsStore } from "./useLogsStore";
import { useInsightStatusStore } from "./useInsightStatusStore";

const resetConnection = () => useConnectionStore.getState().resetConnectionState();
const resetDashboard = () => useDashboardStore.getState().resetDashboardState();
const resetExplorer = () => useExplorerStore.getState().reset();
const resetFleet = () => usePageFiltersStore.getState().resetFleetFilters();
const resetLlm = () => useLLMStore.getState().resetLLMState();
const resetProfiling = () => usePageFiltersStore.getState().resetProfilingFilters();
const resetQuery = () => useQueryStore.getState().resetQueryState();
const resetServices = () => usePageFiltersStore.getState().resetServiceFilters();
const resetKubernetes = () => usePageFiltersStore.getState().resetKubernetesFilters();
const resetHosts = () => usePageFiltersStore.getState().resetHostsFilters();
const resetTraces = () => useTracesStore.getState().resetFilters();
const resetUi = () => useUIStore.getState().resetUIState();
const resetTheme = () => useThemeStore.getState().resetThemeState();
const resetCommandPalette = () => useCommandPaletteStore.getState().resetCommandPaletteState();
const resetSearchPanelUi = () => useSearchPanelUIStore.getState().resetSearchPanelUIState();
const resetApiConsole = () => useApiConsoleStore.getState().resetApiConsoleState();
const resetPageContext = () => usePageContextStore.getState().resetPageContext();
const resetLogs = () => useLogsStore.getState().reset();
const resetInsightStatus = () => useInsightStatusStore.getState().resetInsightStatus();

export const storeResetters: ReadonlyArray<() => void> = [
  resetConnection,
  resetDashboard,
  resetExplorer,
  resetFleet,
  resetHosts,
  resetKubernetes,
  resetLlm,
  resetProfiling,
  resetQuery,
  resetServices,
  resetTraces,
  resetLogs,
  resetInsightStatus,
  resetUi,
  resetTheme,
  resetCommandPalette,
  resetSearchPanelUi,
  resetApiConsole,
  resetPageContext,
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
      resetHosts();
      resetProfiling();
      resetServices();
      resetKubernetes();
    },
  },
  {
    label: "LLM and AI assistant configuration",
    reset: resetLlm,
  },
  {
    label: "UI preferences (theme, panel state)",
    reset: () => {
      resetUi();
      resetTheme();
      resetCommandPalette();
      resetSearchPanelUi();
    },
  },
  {
    label: "Console history and request state",
    reset: resetApiConsole,
  },
];

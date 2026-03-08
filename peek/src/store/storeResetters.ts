/**
 * Shared registry of all Zustand store reset functions.
 *
 * Every store that exposes a reset API must register its resetter here so that
 * both `useResetAllStores` (runtime) and `resetAllStores` (tests) call a single
 * authoritative list instead of maintaining separate hard-coded copies.
 *
 * Domain-specific page-filter stores (Fleet, Profiling, Services, Kubernetes,
 * Hosts) self-register through `resetRegistry.ts` at import time.  The imports
 * below ensure the side-effects run before `storeResetters` is consumed.
 */

import { useConnectionStore } from "./useConnectionStore";
import { useDashboardStore } from "./useDashboardStore";
import { useExplorerStore } from "./useExplorerStore";
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
import { usePackageBuilderStore } from "./usePackageBuilderStore";

// Side-effect imports: each domain store registers its resetter via the
// resetRegistry when first imported.
import "./useFleetFiltersStore";
import "./useProfilingFiltersStore";
import "./useServiceFiltersStore";
import "./useKubernetesFiltersStore";
import "./useHostsFiltersStore";

import { getRegisteredResetters } from "./resetRegistry";

const resetConnection = () => useConnectionStore.getState().resetConnectionState();
const resetDashboard = () => useDashboardStore.getState().resetDashboardState();
const resetExplorer = () => useExplorerStore.getState().reset();
const resetLlm = () => useLLMStore.getState().resetLLMState();
const resetQuery = () => useQueryStore.getState().resetQueryState();
const resetTraces = () => useTracesStore.getState().resetFilters();
const resetUi = () => useUIStore.getState().resetUIState();
const resetTheme = () => useThemeStore.getState().resetThemeState();
const resetCommandPalette = () => useCommandPaletteStore.getState().resetCommandPaletteState();
const resetSearchPanelUi = () => useSearchPanelUIStore.getState().resetSearchPanelUIState();
const resetApiConsole = () => useApiConsoleStore.getState().resetApiConsoleState();
const resetPageContext = () => usePageContextStore.getState().resetPageContext();
const resetLogs = () => useLogsStore.getState().reset();
const resetPackageBuilder = () => usePackageBuilderStore.getState().reset();

export const storeResetters: ReadonlyArray<() => void> = [
  resetConnection,
  resetDashboard,
  resetExplorer,
  // Domain-scoped page-filter resetters are pulled from the registry so that
  // adding a new domain store never requires editing this file.
  ...getRegisteredResetters(),
  resetLlm,
  resetQuery,
  resetTraces,
  resetLogs,
  resetUi,
  resetTheme,
  resetCommandPalette,
  resetSearchPanelUi,
  resetApiConsole,
  resetPageContext,
  resetPackageBuilder,
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
    label: "Observability filters (traces, metrics, logs, fleet, hosts, profiling, services)",
    reset: () => {
      resetTraces();
      resetExplorer();
      resetLogs();
      // Reset all domain-scoped page-filter stores via the registry.
      getRegisteredResetters().forEach((fn) => fn());
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
  {
    label: "Package Builder wizard drafts",
    reset: resetPackageBuilder,
  },
];

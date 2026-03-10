/**
 * Shared registry of all Zustand store reset functions.
 *
 * Every store self-registers its resetter via `resetRegistry.ts` at import
 * time.  The side-effect imports below ensure all stores are loaded (and
 * therefore registered) before `storeResetters` or `RESET_SCOPE` are
 * consumed at runtime.
 *
 * Test code should import `getRegisteredResetters` from `resetRegistry.ts`
 * directly — this avoids a static dependency on every store and keeps
 * vitest's `--related` graph tight.
 */

// Side-effect imports: ensure every store registers its resetter.
import "./useConnectionStore";
import "./useDashboardStore";
import "./useExplorerStore";
import "./useLLMStore";
import "./useQueryStore";
import "./useTracesStore";
import "./useUIStore";
import "./useThemeStore";
import "./useCommandPaletteStore";
import "./useSearchPanelUIStore";
import "./useApiConsoleStore";
import "./usePageContextStore";
import "./useLogsStore";
import "./useInsightStatusStore";
import "./usePackageBuilderStore";
import "./useFleetFiltersStore";
import "./useProfilingFiltersStore";
import "./useServiceFiltersStore";
import "./useKubernetesFiltersStore";
import "./useHostsFiltersStore";

import { getRegisteredResetters, getResetter } from "./resetRegistry";

/** All registered resetters — use at runtime to reset every store. */
export const storeResetters: ReadonlyArray<() => void> = getRegisteredResetters();

/** Helper that calls a named resetter, silently no-ops if missing. */
function reset(name: string): void {
  getResetter(name)?.();
}

export const RESET_SCOPE: ReadonlyArray<{ label: string; reset: () => void }> = [
  {
    label: "Connection settings and credentials",
    reset: () => reset("connection"),
  },
  {
    label: "Dashboard layouts and state",
    reset: () => reset("dashboard"),
  },
  {
    label: "Query Lab filters and queries",
    reset: () => reset("query"),
  },
  {
    label: "Observability filters (traces, metrics, logs, fleet, hosts, profiling, services)",
    reset: () => {
      reset("traces");
      reset("explorer");
      reset("logs");
      reset("fleet");
      reset("profiling");
      reset("services");
      reset("kubernetes");
      reset("hosts");
    },
  },
  {
    label: "LLM and AI assistant configuration",
    reset: () => reset("llm"),
  },
  {
    label: "UI preferences (theme, panel state)",
    reset: () => {
      reset("ui");
      reset("theme");
      reset("commandPalette");
      reset("searchPanelUI");
    },
  },
  {
    label: "Console history and request state",
    reset: () => reset("apiConsole"),
  },
  {
    label: "Package Editor drafts",
    reset: () => reset("packageBuilder"),
  },
];

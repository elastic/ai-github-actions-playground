import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const MIN_EDITOR_HEIGHT = 60;
const MAX_EDITOR_HEIGHT = 600;

function clampEditorHeight(value: number, fallback: number): number {
  return Number.isFinite(value)
    ? Math.min(MAX_EDITOR_HEIGHT, Math.max(MIN_EDITOR_HEIGHT, value))
    : fallback;
}

interface SearchPanelUIState {
  discoverEditorHeight: number;
  panelEditorHeight: number;
  traceEditorHeight: number;
  discoverSearchCollapsed: boolean;
  traceSearchCollapsed: boolean;
  traceMetricsChartsCollapsed: boolean;
  logsSearchCollapsed: boolean;
  metricsSearchCollapsed: boolean;

  setDiscoverEditorHeight: (height: number) => void;
  setPanelEditorHeight: (height: number) => void;
  setTraceEditorHeight: (height: number) => void;
  setDiscoverSearchCollapsed: (collapsed: boolean) => void;
  setTraceSearchCollapsed: (collapsed: boolean) => void;
  setTraceMetricsChartsCollapsed: (collapsed: boolean) => void;
  setLogsSearchCollapsed: (collapsed: boolean) => void;
  setMetricsSearchCollapsed: (collapsed: boolean) => void;
  resetSearchPanelUIState: () => void;
}

const STORE_NAME = "elastic-peek-search-panel-ui";
const DEFAULT_SEARCH_PANEL_UI_STATE = {
  discoverEditorHeight: 100,
  panelEditorHeight: 120,
  traceEditorHeight: 140,
  discoverSearchCollapsed: false,
  traceSearchCollapsed: false,
  traceMetricsChartsCollapsed: true,
  logsSearchCollapsed: false,
  metricsSearchCollapsed: false,
};

export const useSearchPanelUIStore = create<SearchPanelUIState>()(
  devtools(
    persist(
      (set) => ({
        ...DEFAULT_SEARCH_PANEL_UI_STATE,

        setDiscoverEditorHeight: (height) =>
          set({
            discoverEditorHeight: clampEditorHeight(
              height,
              DEFAULT_SEARCH_PANEL_UI_STATE.discoverEditorHeight,
            ),
          }),
        setPanelEditorHeight: (height) =>
          set({
            panelEditorHeight: clampEditorHeight(
              height,
              DEFAULT_SEARCH_PANEL_UI_STATE.panelEditorHeight,
            ),
          }),
        setTraceEditorHeight: (height) =>
          set({
            traceEditorHeight: clampEditorHeight(
              height,
              DEFAULT_SEARCH_PANEL_UI_STATE.traceEditorHeight,
            ),
          }),
        setDiscoverSearchCollapsed: (collapsed) => set({ discoverSearchCollapsed: collapsed }),
        setTraceSearchCollapsed: (collapsed) => set({ traceSearchCollapsed: collapsed }),
        setTraceMetricsChartsCollapsed: (collapsed) =>
          set({ traceMetricsChartsCollapsed: collapsed }),
        setLogsSearchCollapsed: (collapsed) => set({ logsSearchCollapsed: collapsed }),
        setMetricsSearchCollapsed: (collapsed) => set({ metricsSearchCollapsed: collapsed }),
        resetSearchPanelUIState: () => {
          useSearchPanelUIStore.persist.clearStorage();
          set(DEFAULT_SEARCH_PANEL_UI_STATE);
        },
      }),
      {
        name: STORE_NAME,
        partialize: (state) => ({
          discoverEditorHeight: state.discoverEditorHeight,
          panelEditorHeight: state.panelEditorHeight,
          traceEditorHeight: state.traceEditorHeight,
          discoverSearchCollapsed: state.discoverSearchCollapsed,
          traceSearchCollapsed: state.traceSearchCollapsed,
          traceMetricsChartsCollapsed: state.traceMetricsChartsCollapsed,
          logsSearchCollapsed: state.logsSearchCollapsed,
          metricsSearchCollapsed: state.metricsSearchCollapsed,
        }),
      },
    ),
    { name: "SearchPanelUIStore", enabled: import.meta.env.DEV },
  ),
);

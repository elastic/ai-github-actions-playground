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
  discoverSearchCollapsed: boolean;
  traceSearchCollapsed: boolean;
  logsSearchCollapsed: boolean;
  metricsSearchCollapsed: boolean;

  setDiscoverEditorHeight: (height: number) => void;
  setPanelEditorHeight: (height: number) => void;
  setDiscoverSearchCollapsed: (collapsed: boolean) => void;
  setTraceSearchCollapsed: (collapsed: boolean) => void;
  setLogsSearchCollapsed: (collapsed: boolean) => void;
  setMetricsSearchCollapsed: (collapsed: boolean) => void;
  resetSearchPanelUIState: () => void;
}

const STORE_NAME = "elastic-peek-search-panel-ui";
const DEFAULT_SEARCH_PANEL_UI_STATE = {
  discoverEditorHeight: 100,
  panelEditorHeight: 120,
  discoverSearchCollapsed: false,
  traceSearchCollapsed: false,
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
        setDiscoverSearchCollapsed: (collapsed) => set({ discoverSearchCollapsed: collapsed }),
        setTraceSearchCollapsed: (collapsed) => set({ traceSearchCollapsed: collapsed }),
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
          discoverSearchCollapsed: state.discoverSearchCollapsed,
          traceSearchCollapsed: state.traceSearchCollapsed,
          logsSearchCollapsed: state.logsSearchCollapsed,
          metricsSearchCollapsed: state.metricsSearchCollapsed,
        }),
      },
    ),
    { name: "SearchPanelUIStore", enabled: import.meta.env.DEV },
  ),
);

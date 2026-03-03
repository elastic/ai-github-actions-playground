import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const MAX_RECENT_COMMANDS = 5;
const MIN_EDITOR_HEIGHT = 60;
const MAX_EDITOR_HEIGHT = 600;

function clampEditorHeight(value: number, fallback: number): number {
  return Number.isFinite(value)
    ? Math.min(MAX_EDITOR_HEIGHT, Math.max(MIN_EDITOR_HEIGHT, value))
    : fallback;
}

interface UIState {
  themeMode: "light" | "dark";
  editingPanelId: string | null;
  connectionDialogOpen: boolean;
  commandPaletteOpen: boolean;
  aiPanelOpen: boolean;
  explainModeActive: boolean;
  discoverEditorHeight: number;
  panelEditorHeight: number;
  traceSearchCollapsed: boolean;
  recentCommandIds: string[];

  setThemeMode: (mode: "light" | "dark") => void;
  setEditingPanelId: (id: string | null) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setAiPanelOpen: (open: boolean) => void;
  setExplainModeActive: (active: boolean) => void;
  setDiscoverEditorHeight: (height: number) => void;
  setPanelEditorHeight: (height: number) => void;
  setTraceSearchCollapsed: (collapsed: boolean) => void;
  addRecentCommandId: (id: string) => void;
  resetUIState: () => void;
}

const STORE_NAME = "elastic-peek-ui";
const DEFAULT_UI_STATE = {
  themeMode: "dark" as const,
  editingPanelId: null as string | null,
  connectionDialogOpen: false,
  commandPaletteOpen: false,
  aiPanelOpen: false,
  explainModeActive: false,
  discoverEditorHeight: 100,
  panelEditorHeight: 120,
  traceSearchCollapsed: false,
  recentCommandIds: [] as string[],
};

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        ...DEFAULT_UI_STATE,

        setThemeMode: (mode) => set({ themeMode: mode }),
        setEditingPanelId: (id) => set({ editingPanelId: id }),
        setConnectionDialogOpen: (open) => set({ connectionDialogOpen: open }),
        setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
        setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
        setExplainModeActive: (active) => set({ explainModeActive: active }),
        setDiscoverEditorHeight: (height) =>
          set({
            discoverEditorHeight: clampEditorHeight(height, DEFAULT_UI_STATE.discoverEditorHeight),
          }),
        setPanelEditorHeight: (height) =>
          set({ panelEditorHeight: clampEditorHeight(height, DEFAULT_UI_STATE.panelEditorHeight) }),
        setTraceSearchCollapsed: (collapsed) => set({ traceSearchCollapsed: collapsed }),
        addRecentCommandId: (id) =>
          set((state) => ({
            recentCommandIds: [id, ...state.recentCommandIds.filter((i) => i !== id)].slice(
              0,
              MAX_RECENT_COMMANDS,
            ),
          })),
        resetUIState: () => {
          useUIStore.persist.clearStorage();
          set(DEFAULT_UI_STATE);
        },
      }),
      {
        name: STORE_NAME,
        partialize: (state) => ({
          themeMode: state.themeMode,
          discoverEditorHeight: state.discoverEditorHeight,
          panelEditorHeight: state.panelEditorHeight,
          traceSearchCollapsed: state.traceSearchCollapsed,
          recentCommandIds: state.recentCommandIds,
        }),
      },
    ),
    { name: "UIStore", enabled: import.meta.env.DEV },
  ),
);

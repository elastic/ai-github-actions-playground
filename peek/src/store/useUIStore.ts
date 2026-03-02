import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface UIState {
  themeMode: "light" | "dark";
  editingPanelId: string | null;
  connectionDialogOpen: boolean;
  commandPaletteOpen: boolean;
  aiPanelOpen: boolean;
  explainModeActive: boolean;
  discoverEditorHeight: number;
  panelEditorHeight: number;

  setThemeMode: (mode: "light" | "dark") => void;
  setEditingPanelId: (id: string | null) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setAiPanelOpen: (open: boolean) => void;
  setExplainModeActive: (active: boolean) => void;
  setDiscoverEditorHeight: (height: number) => void;
  setPanelEditorHeight: (height: number) => void;
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
        setDiscoverEditorHeight: (height) => set({ discoverEditorHeight: height }),
        setPanelEditorHeight: (height) => set({ panelEditorHeight: height }),
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
        }),
      },
    ),
    { name: "UIStore", enabled: import.meta.env.DEV },
  ),
);

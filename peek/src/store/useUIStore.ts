import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface UIState {
  themeMode: "light" | "dark";
  editingPanelId: string | null;
  connectionDialogOpen: boolean;
  commandPaletteOpen: boolean;
  aiPanelOpen: boolean;
  explainModeActive: boolean;

  setThemeMode: (mode: "light" | "dark") => void;
  setEditingPanelId: (id: string | null) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setAiPanelOpen: (open: boolean) => void;
  setExplainModeActive: (active: boolean) => void;
  resetUIState: () => void;
}

const STORE_NAME = "elastic-peek-ui";

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        themeMode: "dark",
        editingPanelId: null,
        connectionDialogOpen: false,
        commandPaletteOpen: false,
        aiPanelOpen: false,
        explainModeActive: false,

        setThemeMode: (mode) => set({ themeMode: mode }),
        setEditingPanelId: (id) => set({ editingPanelId: id }),
        setConnectionDialogOpen: (open) => set({ connectionDialogOpen: open }),
        setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
        setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
        setExplainModeActive: (active) => set({ explainModeActive: active }),
        resetUIState: () => {
          useUIStore.persist.clearStorage();
          set({
            themeMode: "dark",
            editingPanelId: null,
            connectionDialogOpen: false,
            commandPaletteOpen: false,
            aiPanelOpen: false,
            explainModeActive: false,
          });
        },
      }),
      {
        name: STORE_NAME,
        partialize: (state) => ({
          themeMode: state.themeMode,
        }),
      },
    ),
    { name: "UIStore", enabled: import.meta.env.DEV },
  ),
);

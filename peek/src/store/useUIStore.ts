import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  themeMode: "light" | "dark";
  editingPanelId: string | null;
  connectionDialogOpen: boolean;
  commandPaletteOpen: boolean;

  setThemeMode: (mode: "light" | "dark") => void;
  setEditingPanelId: (id: string | null) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  resetUIState: () => void;
}

const STORE_NAME = "elastic-peek-ui";

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      themeMode: "dark",
      editingPanelId: null,
      connectionDialogOpen: false,
      commandPaletteOpen: false,

      setThemeMode: (mode) => set({ themeMode: mode }),
      setEditingPanelId: (id) => set({ editingPanelId: id }),
      setConnectionDialogOpen: (open) => set({ connectionDialogOpen: open }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      resetUIState: () => {
        useUIStore.persist.clearStorage();
        set({
          themeMode: "dark",
          editingPanelId: null,
          connectionDialogOpen: false,
          commandPaletteOpen: false,
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
);

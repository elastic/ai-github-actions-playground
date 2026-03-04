import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * General-purpose dialog and panel UI state.
 *
 * Domain-specific UI concerns have been extracted into dedicated stores:
 * - Theme        → useThemeStore
 * - Command palette → useCommandPaletteStore
 * - Search panel / editor sizing → useSearchPanelUIStore
 */
interface UIState {
  editingPanelId: string | null;
  connectionDialogOpen: boolean;
  aiPanelOpen: boolean;
  explainModeActive: boolean;

  setEditingPanelId: (id: string | null) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  setAiPanelOpen: (open: boolean) => void;
  setExplainModeActive: (active: boolean) => void;
  resetUIState: () => void;
}

const DEFAULT_UI_STATE = {
  editingPanelId: null as string | null,
  connectionDialogOpen: false,
  aiPanelOpen: false,
  explainModeActive: false,
};

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      ...DEFAULT_UI_STATE,

      setEditingPanelId: (id) => set({ editingPanelId: id }),
      setConnectionDialogOpen: (open) => set({ connectionDialogOpen: open }),
      setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
      setExplainModeActive: (active) => set({ explainModeActive: active }),
      resetUIState: () => set(DEFAULT_UI_STATE),
    }),
    { name: "UIStore", enabled: import.meta.env.DEV },
  ),
);

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const MAX_RECENT_COMMANDS = 5;

interface CommandPaletteState {
  commandPaletteOpen: boolean;
  recentCommandIds: string[];

  setCommandPaletteOpen: (open: boolean) => void;
  addRecentCommandId: (id: string) => void;
  resetCommandPaletteState: () => void;
}

const STORE_NAME = "elastic-peek-command-palette";
const DEFAULT_COMMAND_PALETTE_STATE = {
  commandPaletteOpen: false,
  recentCommandIds: [] as string[],
};

export const useCommandPaletteStore = create<CommandPaletteState>()(
  devtools(
    persist(
      (set) => ({
        ...DEFAULT_COMMAND_PALETTE_STATE,

        setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
        addRecentCommandId: (id) =>
          set((state) => ({
            recentCommandIds: [id, ...state.recentCommandIds.filter((i) => i !== id)].slice(
              0,
              MAX_RECENT_COMMANDS,
            ),
          })),
        resetCommandPaletteState: () => {
          useCommandPaletteStore.persist.clearStorage();
          set(DEFAULT_COMMAND_PALETTE_STATE);
        },
      }),
      {
        name: STORE_NAME,
        partialize: (state) => ({
          recentCommandIds: state.recentCommandIds,
        }),
      },
    ),
    { name: "CommandPaletteStore", enabled: import.meta.env.DEV },
  ),
);

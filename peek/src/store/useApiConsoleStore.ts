import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PersistedEntry {
  id: string;
  method: string;
  path: string;
  body: string;
}

export interface ConsoleDraft {
  method: string;
  path: string;
}

interface ApiConsoleState {
  entries: PersistedEntry[];
  consoleDraft: ConsoleDraft | null;
  setEntries: (entries: PersistedEntry[]) => void;
  setConsoleDraft: (draft: ConsoleDraft | null) => void;
  resetApiConsoleState: () => void;
}

const STORE_NAME = "elastic-peek-api-console";

export const useApiConsoleStore = create<ApiConsoleState>()(
  persist(
    (set) => ({
      entries: [],
      consoleDraft: null,
      setEntries: (entries) => set({ entries }),
      setConsoleDraft: (draft) => set({ consoleDraft: draft }),
      resetApiConsoleState: () => {
        useApiConsoleStore.persist.clearStorage();
        set({ entries: [], consoleDraft: null });
      },
    }),
    {
      name: STORE_NAME,
      partialize: (state) => ({
        entries: state.entries,
      }),
    },
  ),
);

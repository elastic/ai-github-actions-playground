import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PersistedEntry {
  id: string;
  method: string;
  path: string;
  body: string;
}

interface ApiConsoleState {
  entries: PersistedEntry[];
  setEntries: (entries: PersistedEntry[]) => void;
  resetApiConsoleState: () => void;
}

const STORE_NAME = "elastic-peek-api-console";

export const useApiConsoleStore = create<ApiConsoleState>()(
  persist(
    (set) => ({
      entries: [],
      setEntries: (entries) => set({ entries }),
      resetApiConsoleState: () => {
        localStorage.removeItem(STORE_NAME);
        set({ entries: [] });
      },
    }),
    { name: STORE_NAME },
  ),
);

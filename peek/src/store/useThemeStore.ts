import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface ThemeState {
  themeMode: "light" | "dark";

  setThemeMode: (mode: "light" | "dark") => void;
  resetThemeState: () => void;
}

const STORE_NAME = "elastic-peek-theme";
const DEFAULT_THEME_STATE = {
  themeMode: "dark" as const,
};

export const useThemeStore = create<ThemeState>()(
  devtools(
    persist(
      (set) => ({
        ...DEFAULT_THEME_STATE,

        setThemeMode: (mode) => set({ themeMode: mode }),
        resetThemeState: () => {
          useThemeStore.persist.clearStorage();
          set(DEFAULT_THEME_STATE);
        },
      }),
      {
        name: STORE_NAME,
        partialize: (state) => ({
          themeMode: state.themeMode,
        }),
      },
    ),
    { name: "ThemeStore", enabled: import.meta.env.DEV },
  ),
);

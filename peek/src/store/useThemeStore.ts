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

/** Detect the OS / browser preferred colour scheme; fall back to dark. */
function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches)
    return "light";
  return "dark";
}

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
        onRehydrateStorage: () => (state) => {
          // On first visit (nothing persisted), honour the OS colour scheme.
          // Subsequent visits use the persisted value restored by zustand.
          if (typeof window === "undefined" || !state) return;
          try {
            const stored = window.localStorage.getItem(STORE_NAME);
            if (!stored) {
              const system = getSystemTheme();
              if (system !== state.themeMode) state.setThemeMode(system);
            }
          } catch {
            /* localStorage may be unavailable (e.g. in sandboxed iframes) */
          }
        },
      },
    ),
    { name: "ThemeStore", enabled: import.meta.env.DEV },
  ),
);

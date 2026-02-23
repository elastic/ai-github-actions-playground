import { create } from "zustand";
import { persist } from "zustand/middleware";

interface QueryState {
  discoverQueryDraft: string | null;
  queryHistory: string[];

  setDiscoverQueryDraft: (query: string | null) => void;
  appendQueryToHistory: (query: string) => void;
  resetQueryState: () => void;
}

const STORE_NAME = "elastic-peek-query";
const QUERY_HISTORY_MAX_SIZE = 10;

export const useQueryStore = create<QueryState>()(
  persist(
    (set) => ({
      discoverQueryDraft: null,
      queryHistory: [],

      setDiscoverQueryDraft: (query) => set({ discoverQueryDraft: query }),
      appendQueryToHistory: (query) =>
        set((s) => {
          const trimmedQuery = query.trim();
          if (!trimmedQuery) {
            return {};
          }
          const dedupedHistory = s.queryHistory.filter((entry) => entry !== trimmedQuery);
          return {
            queryHistory: [trimmedQuery, ...dedupedHistory].slice(0, QUERY_HISTORY_MAX_SIZE),
          };
        }),
      resetQueryState: () => {
        localStorage.removeItem(STORE_NAME);
        set({ discoverQueryDraft: null, queryHistory: [] });
      },
    }),
    {
      name: STORE_NAME,
      partialize: (state) => ({
        discoverQueryDraft: state.discoverQueryDraft,
        queryHistory: state.queryHistory,
      }),
    },
  ),
);

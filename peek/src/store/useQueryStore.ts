import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { EsqlResponse } from "../types";

export const DEFAULT_DISCOVER_QUERY = "FROM logs-* | SORT @timestamp | LIMIT 50";

interface QueryState {
  discoverQueryDraft: string | null;
  discoverLastQuery: string;
  discoverLastResult: EsqlResponse | null;
  queryHistory: string[];

  setDiscoverQueryDraft: (query: string | null) => void;
  setDiscoverLastQuery: (query: string) => void;
  setDiscoverLastResult: (result: EsqlResponse | null) => void;
  appendQueryToHistory: (query: string) => void;
  resetQueryState: () => void;
}

const STORE_NAME = "elastic-peek-query";
const QUERY_HISTORY_MAX_SIZE = 10;

export const useQueryStore = create<QueryState>()(
  persist(
    (set) => ({
      discoverQueryDraft: null,
      discoverLastQuery: DEFAULT_DISCOVER_QUERY,
      discoverLastResult: null,
      queryHistory: [],

      setDiscoverQueryDraft: (query) => set({ discoverQueryDraft: query }),
      setDiscoverLastQuery: (query) => set({ discoverLastQuery: query }),
      setDiscoverLastResult: (result) => set({ discoverLastResult: result }),
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
        useQueryStore.persist.clearStorage();
        set({
          discoverQueryDraft: null,
          discoverLastQuery: DEFAULT_DISCOVER_QUERY,
          discoverLastResult: null,
          queryHistory: [],
        });
      },
    }),
    {
      name: STORE_NAME,
      partialize: (state) => ({
        queryHistory: state.queryHistory,
      }),
    },
  ),
);

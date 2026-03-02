import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { EsqlResponse } from "../types";

const DEFAULT_DISCOVER_QUERY = "FROM logs-* | SORT @timestamp | LIMIT 50";

interface QueryState {
  discoverQueryDraft: string | null;
  discoverSessionQuery: string;
  discoverSessionResult: EsqlResponse | null;
  queryHistory: string[];

  /** The set of field names selected for display in the results table. */
  discoverSelectedFields: Set<string>;

  setDiscoverQueryDraft: (query: string | null) => void;
  setDiscoverSessionQuery: (query: string) => void;
  setDiscoverSessionResult: (result: EsqlResponse | null) => void;
  appendQueryToHistory: (query: string) => void;
  setDiscoverSelectedFields: (fields: Set<string>) => void;
  resetQueryState: () => void;
}

const STORE_NAME = "elastic-peek-query";
const QUERY_HISTORY_MAX_SIZE = 10;

export { DEFAULT_DISCOVER_QUERY };

export const useQueryStore = create<QueryState>()(
  devtools(
    persist(
      (set) => ({
        discoverQueryDraft: null,
        discoverSessionQuery: DEFAULT_DISCOVER_QUERY,
        discoverSessionResult: null,
        queryHistory: [],
        discoverSelectedFields: new Set<string>(),

        setDiscoverQueryDraft: (query) => set({ discoverQueryDraft: query }),
        setDiscoverSessionQuery: (query) => set({ discoverSessionQuery: query }),
        setDiscoverSessionResult: (result) => set({ discoverSessionResult: result }),
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
        setDiscoverSelectedFields: (fields) => set({ discoverSelectedFields: fields }),
        resetQueryState: () => {
          useQueryStore.persist.clearStorage();
          set({
            discoverQueryDraft: null,
            discoverSessionQuery: DEFAULT_DISCOVER_QUERY,
            discoverSessionResult: null,
            queryHistory: [],
            discoverSelectedFields: new Set<string>(),
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
    { name: "QueryStore", enabled: import.meta.env.DEV },
  ),
);

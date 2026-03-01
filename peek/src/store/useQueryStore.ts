import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { EsqlResponse } from "../types";

const DEFAULT_DISCOVER_QUERY = "FROM logs-* | SORT @timestamp | LIMIT 50";

interface QueryState {
  discoverQueryDraft: string | null;
  queryHistory: string[];

  /** The current ES|QL query text in the Query Lab editor. */
  discoverQuery: string;
  /** The last successful query result (session-only, not persisted to localStorage). */
  discoverResult: EsqlResponse | null;
  /** The set of field names selected for display in the results table. */
  discoverSelectedFields: Set<string>;

  setDiscoverQueryDraft: (query: string | null) => void;
  appendQueryToHistory: (query: string) => void;
  setDiscoverQuery: (query: string) => void;
  setDiscoverResult: (result: EsqlResponse | null) => void;
  setDiscoverSelectedFields: (fields: Set<string>) => void;
  resetQueryState: () => void;
}

const STORE_NAME = "elastic-peek-query";
const QUERY_HISTORY_MAX_SIZE = 10;

export { DEFAULT_DISCOVER_QUERY };

export const useQueryStore = create<QueryState>()(
  persist(
    (set) => ({
      discoverQueryDraft: null,
      queryHistory: [],
      discoverQuery: DEFAULT_DISCOVER_QUERY,
      discoverResult: null,
      discoverSelectedFields: new Set<string>(),

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
      setDiscoverQuery: (query) => set({ discoverQuery: query }),
      setDiscoverResult: (result) => set({ discoverResult: result }),
      setDiscoverSelectedFields: (fields) => set({ discoverSelectedFields: fields }),
      resetQueryState: () => {
        useQueryStore.persist.clearStorage();
        set({
          discoverQueryDraft: null,
          queryHistory: [],
          discoverQuery: DEFAULT_DISCOVER_QUERY,
          discoverResult: null,
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
);

import { create } from "zustand";
import { devtools } from "zustand/middleware";

import type { EsqlResponse } from "../types";
import {
  DEFAULT_LOGS_QUERY_STATE,
  type LogsFilterChip,
  type LogsQueryState,
} from "../components/logs/logsQueryBuilder";

interface LogsState extends LogsQueryState {
  rawQuery: string | null;
  result: EsqlResponse | null;
  setSearchText: (searchText: string) => void;
  addFilter: (filter: LogsFilterChip) => void;
  removeFilter: (index: number) => void;
  clearFilters: () => void;
  setSelectedColumns: (selectedColumns: string[]) => void;
  setRawQuery: (query: string | null) => void;
  setResult: (result: EsqlResponse | null) => void;
  reset: () => void;
}

const initialState: LogsQueryState = { ...DEFAULT_LOGS_QUERY_STATE };

export const useLogsStore = create<LogsState>()(
  devtools(
    (set) => ({
      ...initialState,
      rawQuery: null,
      result: null,
      setSearchText: (searchText) => set({ searchText, rawQuery: null }),
      addFilter: (filter) =>
        set((state) => {
          const exists = state.filters.some(
            (item) =>
              item.field === filter.field &&
              item.value === filter.value &&
              Boolean(item.exclude) === Boolean(filter.exclude),
          );
          if (exists) return state;
          return { filters: [...state.filters, filter], rawQuery: null };
        }),
      removeFilter: (index) =>
        set((state) => ({
          filters: state.filters.filter((_, idx) => idx !== index),
          rawQuery: null,
        })),
      clearFilters: () => set({ filters: [], rawQuery: null }),
      setSelectedColumns: (selectedColumns) => set({ selectedColumns, rawQuery: null }),
      setRawQuery: (rawQuery) => set({ rawQuery }),
      setResult: (result) => set({ result }),
      reset: () => set({ ...initialState, rawQuery: null, result: null }),
    }),
    { name: "LogsStore", enabled: import.meta.env.DEV },
  ),
);

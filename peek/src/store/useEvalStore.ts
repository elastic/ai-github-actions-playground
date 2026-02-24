import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface JudgedQuery {
  query: string;
  relevant: string[];
}

export interface QueryEvalResult {
  query: string;
  retrievedIds: string[];
  recall: number;
  precision: number;
  ndcg: number;
  durationMs: number | null;
  error: string | null;
}

export interface EvalRun {
  id: string;
  timestamp: string;
  idField: string;
  k: number;
  results: QueryEvalResult[];
}

const DEFAULT_JUDGED_SET_JSON = JSON.stringify(
  [
    {
      query: 'FROM search-index | WHERE MATCH(content, "machine learning") | LIMIT 10',
      relevant: ["doc-1", "doc-5"],
    },
  ],
  null,
  2,
);

const STORE_NAME = "elastic-peek-eval";
const MAX_RUNS = 20;

interface EvalState {
  judgedSetJson: string;
  idField: string;
  k: number;
  runs: EvalRun[];

  setJudgedSetJson: (json: string) => void;
  setIdField: (field: string) => void;
  setK: (k: number) => void;
  addRun: (run: EvalRun) => void;
  clearRuns: () => void;
  resetEvalState: () => void;
}

export const useEvalStore = create<EvalState>()(
  persist(
    (set) => ({
      judgedSetJson: DEFAULT_JUDGED_SET_JSON,
      idField: "_id",
      k: 10,
      runs: [],

      setJudgedSetJson: (json) => set({ judgedSetJson: json }),
      setIdField: (field) => set({ idField: field }),
      setK: (k) => set({ k }),
      addRun: (run) => set((s) => ({ runs: [run, ...s.runs].slice(0, MAX_RUNS) })),
      clearRuns: () => set({ runs: [] }),
      resetEvalState: () => {
        localStorage.removeItem(STORE_NAME);
        set({ judgedSetJson: DEFAULT_JUDGED_SET_JSON, idField: "_id", k: 10, runs: [] });
      },
    }),
    {
      name: STORE_NAME,
      partialize: (state) => ({
        judgedSetJson: state.judgedSetJson,
        idField: state.idField,
        k: state.k,
        runs: state.runs,
      }),
    },
  ),
);

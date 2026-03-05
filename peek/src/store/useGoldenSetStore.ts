import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface GoldenSetState {
  /** Set of document `_id` values pinned as expected results. */
  expectedDocIds: Set<string>;

  /** Toggle a document ID in the golden set. */
  toggleExpectedDoc: (id: string) => void;

  /** Remove all pinned documents. */
  clearExpectedDocs: () => void;
}

const STORE_NAME = "elastic-peek-golden-set";

export const useGoldenSetStore = create<GoldenSetState>()(
  devtools(
    persist(
      (set) => ({
        expectedDocIds: new Set<string>(),

        toggleExpectedDoc: (id) =>
          set((s) => {
            const next = new Set(s.expectedDocIds);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return { expectedDocIds: next };
          }),

        clearExpectedDocs: () => set({ expectedDocIds: new Set<string>() }),
      }),
      {
        name: STORE_NAME,
        partialize: (state) => ({
          expectedDocIds: [...state.expectedDocIds],
        }),
        merge: (persisted, current) => {
          const p = persisted as { expectedDocIds?: string[] } | undefined;
          return {
            ...current,
            expectedDocIds: new Set(p?.expectedDocIds ?? []),
          };
        },
      },
    ),
    { name: "GoldenSetStore", enabled: import.meta.env.DEV },
  ),
);

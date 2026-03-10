import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { PageId } from "../routes/paths";
import { registerResetter } from "./resetRegistry";

interface EasterEggState {
  easterEggMode: boolean;
  visitedPages: PageId[];
  completedObjectiveIds: string[];
  rewardMomentsSeen: string[];

  setEasterEggMode: (enabled: boolean) => void;
  markPageVisited: (page: PageId) => void;
  completeObjective: (objectiveId: string) => void;
  acknowledgeRewardMoment: (rewardId: string) => void;
  resetEasterEggState: () => void;
}

export const STORE_NAME = "elastic-peek-easter-egg";

const DEFAULT_STATE = {
  easterEggMode: false,
  visitedPages: [] as PageId[],
  completedObjectiveIds: [] as string[],
  rewardMomentsSeen: [] as string[],
};

export const useEasterEggStore = create<EasterEggState>()(
  devtools(
    persist(
      (set) => ({
        ...DEFAULT_STATE,

        setEasterEggMode: (enabled) => set({ easterEggMode: enabled }),
        markPageVisited: (page) =>
          set((state) => {
            if (state.visitedPages.includes(page)) return state;
            return { visitedPages: [...state.visitedPages, page] };
          }),
        completeObjective: (objectiveId) =>
          set((state) => {
            if (state.completedObjectiveIds.includes(objectiveId)) return state;
            return { completedObjectiveIds: [...state.completedObjectiveIds, objectiveId] };
          }),
        acknowledgeRewardMoment: (rewardId) =>
          set((state) => {
            if (state.rewardMomentsSeen.includes(rewardId)) return state;
            return { rewardMomentsSeen: [...state.rewardMomentsSeen, rewardId] };
          }),
        resetEasterEggState: () => {
          try {
            localStorage.removeItem(STORE_NAME);
          } catch {
            // Ignore environments where localStorage is not available.
          }
          set(DEFAULT_STATE);
        },
      }),
      {
        name: STORE_NAME,
        partialize: (state) => ({
          easterEggMode: state.easterEggMode,
          visitedPages: state.visitedPages,
          completedObjectiveIds: state.completedObjectiveIds,
          rewardMomentsSeen: state.rewardMomentsSeen,
        }),
      },
    ),
    { name: "EasterEggStore", enabled: import.meta.env.DEV },
  ),
);

registerResetter("easterEgg", () => useEasterEggStore.getState().resetEasterEggState());

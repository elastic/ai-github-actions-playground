import { describe, it, expect, beforeEach } from "vitest";

import { useEasterEggStore } from "../../src/store/useEasterEggStore";

describe("useEasterEggStore", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useEasterEggStore.getState().resetEasterEggState();
  });

  it("defaults to disabled mode and empty progression", () => {
    const state = useEasterEggStore.getState();
    expect(state.easterEggMode).toBe(false);
    expect(state.visitedPages).toEqual([]);
    expect(state.completedObjectiveIds).toEqual([]);
    expect(state.rewardMomentsSeen).toEqual([]);
  });

  it("tracks unique visited pages and objective completions", () => {
    const store = useEasterEggStore.getState();
    store.markPageVisited("dashboards");
    store.markPageVisited("dashboards");
    store.completeObjective("confirm-first-query");
    store.completeObjective("confirm-first-query");

    const state = useEasterEggStore.getState();
    expect(state.visitedPages).toEqual(["dashboards"]);
    expect(state.completedObjectiveIds).toEqual(["confirm-first-query"]);
  });

  it("reset clears all persisted easter egg state", () => {
    const store = useEasterEggStore.getState();
    store.setEasterEggMode(true);
    store.markPageVisited("discover");
    store.completeObjective("confirm-first-query");
    store.acknowledgeRewardMoment("scout-badge");

    useEasterEggStore.getState().resetEasterEggState();

    const state = useEasterEggStore.getState();
    expect(state.easterEggMode).toBe(false);
    expect(state.visitedPages).toEqual([]);
    expect(state.completedObjectiveIds).toEqual([]);
    expect(state.rewardMomentsSeen).toEqual([]);
  });
});

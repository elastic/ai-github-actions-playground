// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createElement } from "react";

import App from "../../src/App";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { STORE_NAME, useEasterEggStore } from "../../src/store/useEasterEggStore";
import { resetAllStores } from "../fixtures/test-utils";

describe("useEasterEggStore", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))),
    );
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

  it("does not publish store updates for duplicate progression events", () => {
    const updates: Array<{ visited: string[]; completed: string[]; rewards: string[] }> = [];
    const unsubscribe = useEasterEggStore.subscribe((state) => {
      updates.push({
        visited: state.visitedPages,
        completed: state.completedObjectiveIds,
        rewards: state.rewardMomentsSeen,
      });
    });

    const store = useEasterEggStore.getState();
    store.markPageVisited("dashboards");
    store.markPageVisited("dashboards");
    store.completeObjective("confirm-first-query");
    store.completeObjective("confirm-first-query");
    store.acknowledgeRewardMoment("scout-badge");
    store.acknowledgeRewardMoment("scout-badge");

    unsubscribe();

    expect(updates).toHaveLength(3);
    expect(updates[0]?.visited).toEqual(["dashboards"]);
    expect(updates[1]?.completed).toEqual(["confirm-first-query"]);
    expect(updates[2]?.rewards).toEqual(["scout-badge"]);
  });

  it("reset clears all persisted easter egg state", () => {
    const removeItemSpy = vi.spyOn(localStorage, "removeItem");
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
    expect(localStorage.getItem(STORE_NAME)).toBeNull();
    expect(removeItemSpy).toHaveBeenCalledWith(STORE_NAME);
    removeItemSpy.mockRestore();
  });

  it("renders the easter egg overlay when mode is enabled after mount", async () => {
    useConnectionStore.getState().setConnected(true);

    render(createElement(MemoryRouter, { initialEntries: ["/dashboards"] }, createElement(App)));

    expect(screen.queryByLabelText(/isometric quest overlay/i)).not.toBeInTheDocument();

    act(() => {
      useEasterEggStore.getState().setEasterEggMode(true);
    });

    expect(await screen.findByLabelText(/isometric quest overlay/i)).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});

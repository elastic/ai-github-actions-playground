// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from "vitest";

import { useInsightStatusStore } from "../../src/store/useInsightStatusStore";

describe("useInsightStatusStore", () => {
  beforeEach(() => {
    useInsightStatusStore.getState().resetInsightStatus();
  });

  it("starts with default values", () => {
    const state = useInsightStatusStore.getState();
    expect(state.loading).toBe(false);
    expect(state.totalInsights).toBe(0);
    expect(state.dismissedSlotIds.size).toBe(0);
    expect(state.error).toBeNull();
    expect(state.statusMessage).toBeNull();
  });

  it("syncFromProvider updates loading, total, and error", () => {
    useInsightStatusStore.getState().syncFromProvider({
      loading: true,
      totalInsights: 5,
      error: null,
    });

    const state = useInsightStatusStore.getState();
    expect(state.loading).toBe(true);
    expect(state.totalInsights).toBe(5);
    expect(state.error).toBeNull();
  });

  it("syncFromProvider passes through error message", () => {
    useInsightStatusStore.getState().syncFromProvider({
      loading: false,
      totalInsights: 0,
      error: "LLM call failed",
    });

    expect(useInsightStatusStore.getState().error).toBe("LLM call failed");
  });

  it("dismissSlot adds a slot ID to the dismissed set", () => {
    useInsightStatusStore.getState().dismissSlot("health-card");
    useInsightStatusStore.getState().dismissSlot("index-count");

    const dismissed = useInsightStatusStore.getState().dismissedSlotIds;
    expect(dismissed.size).toBe(2);
    expect(dismissed.has("health-card")).toBe(true);
    expect(dismissed.has("index-count")).toBe(true);
  });

  it("dismissSlot is idempotent for the same slot ID", () => {
    useInsightStatusStore.getState().dismissSlot("health-card");
    useInsightStatusStore.getState().dismissSlot("health-card");

    expect(useInsightStatusStore.getState().dismissedSlotIds.size).toBe(1);
  });

  it("clearDismissals resets dismissed set", () => {
    useInsightStatusStore.getState().dismissSlot("health-card");
    useInsightStatusStore.getState().dismissSlot("index-count");

    useInsightStatusStore.getState().clearDismissals();
    expect(useInsightStatusStore.getState().dismissedSlotIds.size).toBe(0);
  });

  it("setStatusMessage updates the status message", () => {
    useInsightStatusStore.getState().setStatusMessage("Analyzing cluster health…");
    expect(useInsightStatusStore.getState().statusMessage).toBe("Analyzing cluster health…");

    useInsightStatusStore.getState().setStatusMessage(null);
    expect(useInsightStatusStore.getState().statusMessage).toBeNull();
  });

  it("resetInsightStatus restores all defaults", () => {
    useInsightStatusStore.getState().syncFromProvider({
      loading: true,
      totalInsights: 3,
      error: "err",
    });
    useInsightStatusStore.getState().dismissSlot("a");
    useInsightStatusStore.getState().setStatusMessage("busy");

    useInsightStatusStore.getState().resetInsightStatus();

    const state = useInsightStatusStore.getState();
    expect(state.loading).toBe(false);
    expect(state.totalInsights).toBe(0);
    expect(state.dismissedSlotIds.size).toBe(0);
    expect(state.error).toBeNull();
    expect(state.statusMessage).toBeNull();
  });
});

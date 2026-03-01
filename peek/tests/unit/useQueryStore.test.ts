// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";

import { useQueryStore } from "../../src/store/useQueryStore";

describe("useQueryStore", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useQueryStore.getState().resetQueryState();
  });

  it("appendQueryToHistory prepends and deduplicates", () => {
    useQueryStore.getState().appendQueryToHistory("FROM logs-* | LIMIT 10");
    useQueryStore.getState().appendQueryToHistory("FROM metrics-* | LIMIT 5");
    useQueryStore.getState().appendQueryToHistory("FROM logs-* | LIMIT 10");

    expect(useQueryStore.getState().queryHistory).toEqual([
      "FROM logs-* | LIMIT 10",
      "FROM metrics-* | LIMIT 5",
    ]);
  });

  it("resetQueryState clears draft and history", () => {
    useQueryStore.getState().setDiscoverQueryDraft("FROM x");
    useQueryStore.getState().appendQueryToHistory("FROM x");

    useQueryStore.getState().resetQueryState();

    expect(useQueryStore.getState().discoverQueryDraft).toBeNull();
    expect(useQueryStore.getState().queryHistory).toEqual([]);
  });
});

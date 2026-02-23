import { describe, it, expect, beforeEach, vi } from "vitest";

import { useQueryStore } from "../../src/store/useQueryStore";
import { makeStorageMock } from "../fixtures/test-utils";

const localStorageMock = makeStorageMock();
const sessionStorageMock = makeStorageMock();

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("sessionStorage", sessionStorageMock);

describe("useQueryStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
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

// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";

import { useGoldenSetStore } from "../../src/store/useGoldenSetStore";

describe("useGoldenSetStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useGoldenSetStore.setState({ expectedDocIds: new Set() });
  });

  it("starts with an empty set", () => {
    expect(useGoldenSetStore.getState().expectedDocIds.size).toBe(0);
  });

  it("toggleExpectedDoc adds an ID to the set", () => {
    useGoldenSetStore.getState().toggleExpectedDoc("doc-1");
    expect(useGoldenSetStore.getState().expectedDocIds.has("doc-1")).toBe(true);
  });

  it("toggleExpectedDoc removes an ID when called twice", () => {
    useGoldenSetStore.getState().toggleExpectedDoc("doc-1");
    useGoldenSetStore.getState().toggleExpectedDoc("doc-1");
    expect(useGoldenSetStore.getState().expectedDocIds.has("doc-1")).toBe(false);
    expect(useGoldenSetStore.getState().expectedDocIds.size).toBe(0);
  });

  it("supports multiple IDs simultaneously", () => {
    useGoldenSetStore.getState().toggleExpectedDoc("doc-1");
    useGoldenSetStore.getState().toggleExpectedDoc("doc-2");
    useGoldenSetStore.getState().toggleExpectedDoc("doc-3");

    const ids = useGoldenSetStore.getState().expectedDocIds;
    expect(ids.size).toBe(3);
    expect(ids.has("doc-1")).toBe(true);
    expect(ids.has("doc-2")).toBe(true);
    expect(ids.has("doc-3")).toBe(true);
  });

  it("clearExpectedDocs removes all IDs", () => {
    useGoldenSetStore.getState().toggleExpectedDoc("doc-1");
    useGoldenSetStore.getState().toggleExpectedDoc("doc-2");
    useGoldenSetStore.getState().clearExpectedDocs();

    expect(useGoldenSetStore.getState().expectedDocIds.size).toBe(0);
  });
});

import { describe, it, expect } from "vitest";

import { recallAtK, precisionAtK, ndcgAtK } from "../../src/components/evalMetrics";

describe("recallAtK", () => {
  it("returns 0 when there are no relevant documents", () => {
    expect(recallAtK(["a", "b", "c"], [], 3)).toBe(0);
  });

  it("returns 1 when all relevant docs are in top-k", () => {
    expect(recallAtK(["a", "b", "c"], ["a", "b"], 3)).toBe(1);
  });

  it("returns partial recall when only some relevant docs are retrieved", () => {
    expect(recallAtK(["a", "x", "y"], ["a", "b"], 3)).toBe(0.5);
  });

  it("respects the k cutoff and ignores documents beyond k", () => {
    // "b" is at position 4 (index 3), beyond k=3
    expect(recallAtK(["a", "x", "y", "b"], ["a", "b"], 3)).toBe(0.5);
  });

  it("returns 0 when no relevant docs appear in top-k", () => {
    expect(recallAtK(["x", "y", "z"], ["a", "b"], 3)).toBe(0);
  });
});

describe("precisionAtK", () => {
  it("returns 0 when k is 0", () => {
    expect(precisionAtK(["a", "b"], ["a"], 0)).toBe(0);
  });

  it("returns 1 when all top-k results are relevant", () => {
    expect(precisionAtK(["a", "b"], ["a", "b", "c"], 2)).toBe(1);
  });

  it("returns 0 when no top-k results are relevant", () => {
    expect(precisionAtK(["x", "y"], ["a", "b"], 2)).toBe(0);
  });

  it("returns partial precision when some top-k results are relevant", () => {
    expect(precisionAtK(["a", "x", "b"], ["a", "b"], 3)).toBeCloseTo(2 / 3);
  });

  it("respects the k cutoff", () => {
    // only "a" is in top-2, "b" is at position 3 (beyond k=2)
    expect(precisionAtK(["a", "x", "b"], ["a", "b"], 2)).toBe(0.5);
  });
});

describe("ndcgAtK", () => {
  it("returns 0 when there are no relevant documents", () => {
    expect(ndcgAtK(["a", "b"], [], 2)).toBe(0);
  });

  it("returns 1 when the single relevant doc is at rank 1", () => {
    expect(ndcgAtK(["a", "b", "c"], ["a"], 3)).toBe(1);
  });

  it("returns 1 when all relevant docs are at the top positions (ideal order)", () => {
    expect(ndcgAtK(["a", "b"], ["a", "b"], 2)).toBe(1);
  });

  it("returns 0 when no relevant docs appear in top-k", () => {
    expect(ndcgAtK(["x", "y", "z"], ["a", "b"], 3)).toBe(0);
  });

  it("returns a lower score when the relevant doc is ranked lower", () => {
    // "a" at rank 1 vs "a" at rank 2 — rank-1 should have higher NDCG
    const ndcgRank1 = ndcgAtK(["a", "x"], ["a"], 2);
    const ndcgRank2 = ndcgAtK(["x", "a"], ["a"], 2);
    expect(ndcgRank1).toBeGreaterThan(ndcgRank2);
    expect(ndcgRank1).toBe(1); // ideal is "a" at rank 1
  });

  it("respects the k cutoff (relevant doc beyond k counts as miss)", () => {
    expect(ndcgAtK(["x", "y", "a"], ["a"], 2)).toBe(0);
  });
});

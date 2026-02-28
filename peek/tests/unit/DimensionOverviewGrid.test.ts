import { describe, expect, it } from "vitest";

import { normalizeDimensionBucketLabel } from "../../src/components/DimensionOverviewGrid.utils";

describe("normalizeDimensionBucketLabel", () => {
  it("normalizes null-ish and placeholder values to unknown", () => {
    expect(normalizeDimensionBucketLabel(null)).toBe("unknown");
    expect(normalizeDimensionBucketLabel(undefined)).toBe("unknown");
    expect(normalizeDimensionBucketLabel("")).toBe("unknown");
    expect(normalizeDimensionBucketLabel("  ")).toBe("unknown");
    expect(normalizeDimensionBucketLabel("-")).toBe("unknown");
  });

  it("keeps real bucket labels", () => {
    expect(normalizeDimensionBucketLabel("host-a")).toBe("host-a");
    expect(normalizeDimensionBucketLabel(" service ")).toBe("service");
    expect(normalizeDimensionBucketLabel(42)).toBe("42");
  });
});

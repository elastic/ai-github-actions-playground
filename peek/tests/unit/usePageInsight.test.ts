import { describe, it, expect } from "vitest";

import { clearInsightCache } from "../../src/hooks/usePageInsight";

describe("usePageInsight – insightCache", () => {
  it("clearInsightCache does not throw", () => {
    expect(() => clearInsightCache()).not.toThrow();
  });
});

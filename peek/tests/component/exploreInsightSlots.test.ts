import { describe, it, expect } from "vitest";

import {
  EXPLORE_INSIGHT_SLOT_IDS,
  EXPLORE_INSIGHT_SLOTS,
} from "../../src/components/explore/exploreInsightSlots";

describe("exploreInsightSlots", () => {
  it("exports deterministic slot IDs", () => {
    expect(EXPLORE_INSIGHT_SLOT_IDS).toEqual({
      exploreSearch: "explore-search",
      exploreContent: "explore-content",
    });
  });

  it("defines one slot definition per ID", () => {
    const ids = Object.values(EXPLORE_INSIGHT_SLOT_IDS);
    expect(EXPLORE_INSIGHT_SLOTS).toHaveLength(ids.length);
    for (const slot of EXPLORE_INSIGHT_SLOTS) {
      expect(ids).toContain(slot.slotId);
      expect(slot.label).toBeTruthy();
    }
  });

  it("has unique slot IDs", () => {
    const slotIds = EXPLORE_INSIGHT_SLOTS.map((s) => s.slotId);
    expect(new Set(slotIds).size).toBe(slotIds.length);
  });
});

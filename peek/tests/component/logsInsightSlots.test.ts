import { describe, it, expect } from "vitest";

import {
  LOGS_INSIGHT_SLOT_IDS,
  LOGS_INSIGHT_SLOTS,
} from "../../src/components/logs/logsInsightSlots";

describe("logsInsightSlots", () => {
  it("exports deterministic slot IDs", () => {
    expect(LOGS_INSIGHT_SLOT_IDS).toEqual({
      logsSearch: "logs-search",
      logsResults: "logs-results",
    });
  });

  it("defines one slot definition per ID", () => {
    const ids = Object.values(LOGS_INSIGHT_SLOT_IDS);
    expect(LOGS_INSIGHT_SLOTS).toHaveLength(ids.length);
    for (const slot of LOGS_INSIGHT_SLOTS) {
      expect(ids).toContain(slot.slotId);
      expect(slot.label).toBeTruthy();
    }
  });

  it("has unique slot IDs", () => {
    const slotIds = LOGS_INSIGHT_SLOTS.map((s) => s.slotId);
    expect(new Set(slotIds).size).toBe(slotIds.length);
  });
});

import { describe, expect, it } from "vitest";

import { toDashboardTimeRange, toTraceTimeRange } from "../../src/components/timePresets";

describe("timePresets conversions", () => {
  it("maps trace preset ranges to dashboard date math", () => {
    expect(toDashboardTimeRange({ from: "NOW() - 1 hour", to: "NOW()" })).toEqual({
      from: "now-1h",
      to: "now",
    });
  });

  it("maps dashboard preset ranges to trace ES|QL expressions", () => {
    expect(toTraceTimeRange({ from: "now-15m", to: "now" })).toEqual({
      from: "NOW() - 15 minutes",
      to: "NOW()",
    });
  });

  it("passes through custom absolute ranges", () => {
    const custom = { from: "2026-02-24T03:00:00.000Z", to: "2026-02-24T04:00:00.000Z" };
    expect(toDashboardTimeRange(custom)).toEqual(custom);
    expect(toTraceTimeRange(custom)).toEqual(custom);
  });
});

import { describe, it, expect } from "vitest";

import {
  stalenessSeverityToColor,
  formatFleetTime,
  formatFleetTimestamp,
} from "../../src/components/fleet/fleetPresentation";

describe("stalenessSeverityToColor", () => {
  it("returns success for fresh", () => {
    expect(stalenessSeverityToColor("fresh")).toBe("success");
  });

  it("returns warning for stale", () => {
    expect(stalenessSeverityToColor("stale")).toBe("warning");
  });

  it("returns error for critical", () => {
    expect(stalenessSeverityToColor("critical")).toBe("error");
  });
});

describe("formatFleetTime", () => {
  it("returns empty string for empty input", () => {
    expect(formatFleetTime("")).toBe("");
  });

  it("formats a valid ISO timestamp as locale time", () => {
    const result = formatFleetTime("2026-02-27T14:30:00.000Z");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns the original string for invalid input", () => {
    expect(formatFleetTime("not-a-date")).toBe("not-a-date");
  });
});

describe("formatFleetTimestamp", () => {
  it("returns empty string for empty input", () => {
    expect(formatFleetTimestamp("")).toBe("");
  });

  it("formats a valid ISO timestamp as locale date+time", () => {
    const result = formatFleetTimestamp("2026-02-27T14:30:00.000Z");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns the original string for invalid input", () => {
    expect(formatFleetTimestamp("not-a-date")).toBe("not-a-date");
  });
});

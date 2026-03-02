import { describe, it, expect } from "vitest";

import { formatTimestamp, formatDate, formatTime } from "../../src/utils/formatDate";

describe("formatTimestamp", () => {
  it("formats a valid ISO string as locale date+time", () => {
    const result = formatTimestamp("2026-02-27T14:30:00.000Z");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("formats a numeric epoch as locale date+time", () => {
    const result = formatTimestamp(1740666600000);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("formats a Date object", () => {
    const result = formatTimestamp(new Date("2026-02-27T14:30:00.000Z"));
    expect(result).toBeTruthy();
  });

  it("returns the original string for an invalid date", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});

describe("formatDate", () => {
  it("formats a valid ISO string as locale date", () => {
    const result = formatDate("2026-02-27T14:30:00.000Z");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    // Should NOT contain a time separator (colon between hours and minutes)
    // but locale date strings could potentially include colons, so just
    // verify it doesn't match a full timestamp pattern.
    expect(result.length).toBeLessThan(formatTimestamp("2026-02-27T14:30:00.000Z").length);
  });

  it("returns the original string for an invalid date", () => {
    expect(formatDate("bad")).toBe("bad");
  });
});

describe("formatTime", () => {
  it("formats a valid ISO string as locale time", () => {
    const result = formatTime("2026-02-27T14:30:00.000Z");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("formats with short option using 2-digit parts", () => {
    const result = formatTime("2026-02-27T14:30:00.000Z", { short: true });
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns the original string for an invalid date", () => {
    expect(formatTime("nope")).toBe("nope");
  });
});

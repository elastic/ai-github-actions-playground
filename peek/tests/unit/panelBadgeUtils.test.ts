import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { formatMs, formatRowCount, formatTimeAgo } from "../../src/components/panelBadgeUtils";

describe("formatMs", () => {
  it("returns plain ms for sub-second values", () => {
    expect(formatMs(0)).toBe("0ms");
    expect(formatMs(142)).toBe("142ms");
    expect(formatMs(999)).toBe("999ms");
  });

  it("returns seconds for values >= 1000ms", () => {
    expect(formatMs(1000)).toBe("1.0s");
    expect(formatMs(2500)).toBe("2.5s");
  });
});

describe("formatRowCount", () => {
  it("returns plain number for counts under 1 000", () => {
    expect(formatRowCount(0)).toBe("0");
    expect(formatRowCount(1)).toBe("1");
    expect(formatRowCount(999)).toBe("999");
  });

  it("returns k notation for thousands", () => {
    expect(formatRowCount(1_000)).toBe("1.0k");
    expect(formatRowCount(2_300)).toBe("2.3k");
    expect(formatRowCount(500_000)).toBe("500.0k");
  });

  it("returns m notation for millions", () => {
    expect(formatRowCount(1_000_000)).toBe("1.0m");
    expect(formatRowCount(1_500_000)).toBe("1.5m");
  });
});

describe("formatTimeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows seconds ago", () => {
    const date = new Date();
    vi.advanceTimersByTime(30_000);
    expect(formatTimeAgo(date)).toBe("30s ago");
  });

  it("shows minutes ago", () => {
    const date = new Date();
    vi.advanceTimersByTime(2 * 60_000);
    expect(formatTimeAgo(date)).toBe("2m ago");
  });

  it("shows hours ago", () => {
    const date = new Date();
    vi.advanceTimersByTime(3 * 3_600_000);
    expect(formatTimeAgo(date)).toBe("3h ago");
  });
});

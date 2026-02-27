import { describe, it, expect } from "vitest";

import { formatBytes } from "../../src/utils/formatBytes";

describe("formatBytes", () => {
  it('returns "n/a" for null by default', () => {
    expect(formatBytes(null)).toBe("n/a");
  });

  it("returns a custom null label when provided", () => {
    expect(formatBytes(null, "Unavailable")).toBe("Unavailable");
  });

  it('returns "0 B" for zero', () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes below 1 KB", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes with one decimal", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats kilobytes >= 10 without decimals", () => {
    expect(formatBytes(10240)).toBe("10 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatBytes(2.5 * 1024 ** 3)).toBe("2.5 GB");
  });

  it("formats terabytes", () => {
    expect(formatBytes(1024 ** 4)).toBe("1.0 TB");
  });

  it("formats petabytes", () => {
    expect(formatBytes(1024 ** 5)).toBe("1.0 PB");
  });

  it("clamps exponent to PB for extremely large values", () => {
    expect(formatBytes(1024 ** 6)).toBe("1024 PB");
  });
});

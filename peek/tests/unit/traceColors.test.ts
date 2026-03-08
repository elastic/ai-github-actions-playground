import { describe, it, expect } from "vitest";

import { getServiceColor, getServiceTextColor } from "../../src/components/traces/traceColors";

function sRGBtoLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

function contrastOnWhite(hex: string): number {
  const lum = relativeLuminance(hex);
  return 1.05 / (lum + 0.05);
}

describe("getServiceColor", () => {
  it("returns the same color for the same service name", () => {
    const a = getServiceColor("my-service");
    const b = getServiceColor("my-service");
    expect(a).toBe(b);
  });

  it("returns a valid hex color", () => {
    expect(getServiceColor("foo")).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe("getServiceTextColor", () => {
  it("returns a color that meets WCAG 4.5:1 contrast on white", () => {
    const services = [
      "frontend",
      "backend",
      "db-service",
      "auth",
      "gateway",
      "cache",
      "queue",
      "worker",
      "scheduler",
      "monitor",
      "logger",
      "analytics",
    ];

    for (const name of services) {
      const textColor = getServiceTextColor(name);
      const ratio = contrastOnWhite(textColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("preserves already-accessible colors unchanged", () => {
    const base = getServiceColor("frontend");
    const text = getServiceTextColor("frontend");
    const baseContrast = contrastOnWhite(base);

    if (baseContrast >= 4.5) {
      expect(text).toBe(base);
    } else {
      expect(relativeLuminance(text)).toBeLessThanOrEqual(relativeLuminance(base));
    }
  });

  it("returns the same color for repeated calls (caching)", () => {
    const a = getServiceTextColor("test-service");
    const b = getServiceTextColor("test-service");
    expect(a).toBe(b);
  });
});

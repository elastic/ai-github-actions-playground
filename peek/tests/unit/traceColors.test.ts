import { describe, it, expect } from "vitest";

import { getServiceColor, getServiceTextColor } from "../../src/components/traces/traceColors";
import { CHART_COLORS } from "../../src/theme";

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
    const representativeByBaseColor = new Map<string, string>();
    const maxAttempts = CHART_COLORS.length * 20;

    for (let i = 0; i < maxAttempts && representativeByBaseColor.size < CHART_COLORS.length; i++) {
      const serviceName = `service-${i}`;
      const baseColor = getServiceColor(serviceName);
      if (!representativeByBaseColor.has(baseColor)) {
        representativeByBaseColor.set(baseColor, serviceName);
      }
    }

    expect(representativeByBaseColor.size).toBe(CHART_COLORS.length);

    for (const name of representativeByBaseColor.values()) {
      const textColor = getServiceTextColor(name);
      const ratio = contrastOnWhite(textColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("preserves already-accessible colors unchanged", () => {
    let accessibleService: string | null = null;
    let inaccessibleService: string | null = null;

    for (let i = 0; i < 500 && (!accessibleService || !inaccessibleService); i++) {
      const name = `service-${i}`;
      const baseContrast = contrastOnWhite(getServiceColor(name));
      if (baseContrast >= 4.5) {
        accessibleService = name;
      } else {
        inaccessibleService = name;
      }
    }

    expect(accessibleService).not.toBeNull();
    expect(inaccessibleService).not.toBeNull();

    const accessibleBase = getServiceColor(accessibleService!);
    const accessibleText = getServiceTextColor(accessibleService!);
    expect(accessibleText).toBe(accessibleBase);

    const inaccessibleBase = getServiceColor(inaccessibleService!);
    const inaccessibleText = getServiceTextColor(inaccessibleService!);
    expect(relativeLuminance(inaccessibleText)).toBeLessThanOrEqual(
      relativeLuminance(inaccessibleBase),
    );
  });

  it("returns the same color for repeated calls", () => {
    const a = getServiceTextColor("test-service");
    const b = getServiceTextColor("test-service");
    expect(a).toBe(b);
  });
});

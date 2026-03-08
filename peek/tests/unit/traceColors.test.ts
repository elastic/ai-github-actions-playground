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

function contrastRatio(fgHex: string, bgHex: string): number {
  const fgLum = relativeLuminance(fgHex);
  const bgLum = relativeLuminance(bgHex);
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function applyAlphaOnWhite(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blend = (channel: number) => Math.round(channel * alpha + 255 * (1 - alpha));
  return `#${blend(r).toString(16).padStart(2, "0")}${blend(g).toString(16).padStart(2, "0")}${blend(b).toString(16).padStart(2, "0")}`;
}

describe("getServiceColor", () => {
  it("returns the same color for the same service name", () => {
    const a = getServiceColor("my-service");
    const b = getServiceColor("my-service");
    expect(a).toBe(b);
  });

  it("returns a chart palette color", () => {
    expect(CHART_COLORS).toContain(getServiceColor("foo"));
  });
});

describe("getServiceTextColor", () => {
  it("returns a color that meets WCAG 4.5:1 contrast on pill background", () => {
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
      const baseColor = getServiceColor(name);
      const pillBackground = applyAlphaOnWhite(baseColor, 0.15);
      const textColor = getServiceTextColor(name);
      const ratio = contrastRatio(textColor, pillBackground);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("preserves already-accessible colors unchanged", () => {
    for (let i = 0; i < 500; i++) {
      const name = `service-${i}`;
      const baseColor = getServiceColor(name);
      const pillBackground = applyAlphaOnWhite(baseColor, 0.15);
      const baseContrast = contrastRatio(baseColor, pillBackground);
      const textColor = getServiceTextColor(name);

      if (baseContrast >= 4.5) {
        expect(textColor).toBe(baseColor);
      } else {
        expect(contrastRatio(textColor, pillBackground)).toBeGreaterThanOrEqual(4.5);
        expect(relativeLuminance(textColor)).toBeLessThanOrEqual(relativeLuminance(baseColor));
      }
    }
  });

  it("returns the same color for repeated calls", () => {
    const a = getServiceTextColor("test-service");
    const b = getServiceTextColor("test-service");
    expect(a).toBe(b);
  });
});

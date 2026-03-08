import { describe, it, expect } from "vitest";

import { getServiceColor, getServiceTextColor } from "../../src/components/traces/traceColors";
import { CHART_COLORS } from "../../src/theme";
import { contrastRatio, relativeLuminance } from "../../src/utils/colorContrast";

function applyAlphaOnSurface(hex: string, alpha: number, surfaceHex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const sr = parseInt(surfaceHex.slice(1, 3), 16);
  const sg = parseInt(surfaceHex.slice(3, 5), 16);
  const sb = parseInt(surfaceHex.slice(5, 7), 16);
  const blend = (channel: number, surfaceChannel: number) =>
    Math.round(channel * alpha + surfaceChannel * (1 - alpha));
  return `#${blend(r, sr).toString(16).padStart(2, "0")}${blend(g, sg).toString(16).padStart(2, "0")}${blend(b, sb).toString(16).padStart(2, "0")}`;
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
    const surfaceColor = "#ffffff";
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
      const pillBackground = applyAlphaOnSurface(baseColor, 0.15, surfaceColor);
      const textColor = getServiceTextColor(name, surfaceColor);
      const ratio = contrastRatio(textColor, pillBackground);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("preserves already-accessible colors unchanged", () => {
    const surfaceColor = "#ffffff";
    for (let i = 0; i < 500; i++) {
      const name = `service-${i}`;
      const baseColor = getServiceColor(name);
      const pillBackground = applyAlphaOnSurface(baseColor, 0.15, surfaceColor);
      const baseContrast = contrastRatio(baseColor, pillBackground);
      const textColor = getServiceTextColor(name, surfaceColor);

      if (baseContrast >= 4.5) {
        expect(textColor).toBe(baseColor);
      } else {
        expect(contrastRatio(textColor, pillBackground)).toBeGreaterThanOrEqual(4.5);
        expect(relativeLuminance(textColor)).toBeLessThanOrEqual(relativeLuminance(baseColor));
      }
    }
  });

  it("meets contrast on dark surfaces too", () => {
    const surfaceColor = "#121212";
    const representativeByBaseColor = new Map<string, string>();
    const maxAttempts = CHART_COLORS.length * 20;
    for (let i = 0; i < maxAttempts && representativeByBaseColor.size < CHART_COLORS.length; i++) {
      const name = `dark-service-${i}`;
      const baseColor = getServiceColor(name);
      if (!representativeByBaseColor.has(baseColor)) {
        representativeByBaseColor.set(baseColor, name);
      }
    }

    expect(representativeByBaseColor.size).toBe(CHART_COLORS.length);
    for (const name of representativeByBaseColor.values()) {
      const textColor = getServiceTextColor(name, surfaceColor);
      const pillBackground = applyAlphaOnSurface(getServiceColor(name), 0.15, surfaceColor);
      expect(contrastRatio(textColor, pillBackground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("returns the same color for repeated calls", () => {
    const a = getServiceTextColor("test-service", "#ffffff");
    const b = getServiceTextColor("test-service", "#ffffff");
    expect(a).toBe(b);
  });
});

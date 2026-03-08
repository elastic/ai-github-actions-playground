import { describe, it, expect } from "vitest";

import { CHART_COLORS } from "../../src/theme";
import { STATUS_COLORS } from "../../src/types/tokens";
import {
  contrastRatio,
  getLabelColor,
  hexToRgb,
  relativeLuminance,
} from "../../src/utils/colorContrast";

/* ------------------------------------------------------------------ */
/*  All colors that appear in FRAME_TYPE_COLORS palettes               */
/* ------------------------------------------------------------------ */

const FRAME_PALETTE_COLORS = [
  ...new Set([
    STATUS_COLORS.error,
    STATUS_COLORS.warning,
    STATUS_COLORS.success,
    STATUS_COLORS.info,
    STATUS_COLORS.inProgress,
    ...CHART_COLORS,
  ]),
];

describe("ProfilingFlamegraph label contrast", () => {
  it("shared helper luminance math handles hex parsing", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(relativeLuminance("#000")).toBe(0);
  });

  it("rejects malformed hex colors", () => {
    expect(() => hexToRgb("#abcd")).toThrow("Unsupported hex color");
    expect(() => hexToRgb("#fff0")).toThrow("Unsupported hex color");
  });

  it.each(FRAME_PALETTE_COLORS)("adaptive label on %s meets WCAG AA 4.5:1", (bg) => {
    const label = getLabelColor(bg);
    const ratio = contrastRatio(label, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

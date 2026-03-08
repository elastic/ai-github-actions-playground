import { describe, it, expect } from "vitest";

import { CHART_COLORS } from "../../src/theme";
import { STATUS_COLORS } from "../../src/types/tokens";

/* ------------------------------------------------------------------ */
/*  WCAG 2.1 contrast helpers (mirrors the logic in ProfilingFlamegraph) */
/* ------------------------------------------------------------------ */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const norm =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const int = Number.parseInt(norm, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Same logic as getLabelColor in ProfilingFlamegraph.tsx */
function getLabelColor(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.179 ? "#000" : "#fff";
}

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
  it.each(FRAME_PALETTE_COLORS)("adaptive label on %s meets WCAG AA 4.5:1", (bg) => {
    const label = getLabelColor(bg);
    const ratio = contrastRatio(label, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

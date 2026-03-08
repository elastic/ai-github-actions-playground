import { CHART_COLORS } from "../../theme";

/**
 * Deterministic service → color mapping.
 * Uses a simple string hash so the same service always gets the same color
 * across the waterfall, scatter plot, and any other visualization.
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getServiceColor(serviceName: string): string {
  const index = hashCode(serviceName) % CHART_COLORS.length;
  return CHART_COLORS[index]!;
}

/* ── Accessible text color for service pills ── */

function sRGBtoLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

function parseHex(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Contrast ratio between two luminance values.
 */
function contrastRatio(lighter: number, darker: number): number {
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Render the alpha(serviceColor, 0.15) pill background over white.
 */
function servicePillBackground(hex: string): [number, number, number] {
  const [r, g, b] = parseHex(hex);
  const alpha = 0.15;
  return [
    Math.round(r * alpha + 255 * (1 - alpha)),
    Math.round(g * alpha + 255 * (1 - alpha)),
    Math.round(b * alpha + 255 * (1 - alpha)),
  ];
}

/**
 * Darken a hex color until it meets WCAG AA (4.5 : 1) contrast on service pill background.
 * Returns the original color if it already passes.
 */
function ensureContrastOnPillBackground(hex: string, minRatio = 4.5): string {
  const [r, g, b] = parseHex(hex);
  const background = servicePillBackground(hex);
  const bgLum = relativeLuminance(background[0], background[1], background[2]);
  const baseLum = relativeLuminance(r, g, b);
  const contrast = contrastRatio(Math.max(baseLum, bgLum), Math.min(baseLum, bgLum));
  if (contrast >= minRatio) return hex;

  let factor = 1.0;
  while (factor > 0) {
    factor -= 0.02;
    const dr = Math.round(r * factor);
    const dg = Math.round(g * factor);
    const db = Math.round(b * factor);
    const dlum = relativeLuminance(dr, dg, db);
    const darkContrast = contrastRatio(Math.max(dlum, bgLum), Math.min(dlum, bgLum));
    if (darkContrast >= minRatio) {
      return toHex(dr, dg, db);
    }
  }
  return "#000000";
}

const textColorCache = new Map<string, string>();

/**
 * Returns a WCAG-safe text color derived from the service color.
 * Light chart colors are darkened so they meet 4.5 : 1 contrast on the
 * rendered service pill background.
 */
export function getServiceTextColor(serviceName: string): string {
  const base = getServiceColor(serviceName);
  const cached = textColorCache.get(base);
  if (cached) return cached;
  const safe = ensureContrastOnPillBackground(base);
  textColorCache.set(base, safe);
  return safe;
}

/**
 * Build a color map for a set of service names so every lookup is O(1).
 */
export function buildServiceColorMap(serviceNames: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const name of serviceNames) {
    if (!map.has(name)) {
      map.set(name, getServiceColor(name));
    }
  }
  return map;
}

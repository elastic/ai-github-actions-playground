import { CHART_COLORS } from "../../theme";
import { contrastRatio, hexToRgb } from "../../utils/colorContrast";

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

function parseHex(hex: string): [number, number, number] {
  return hexToRgb(hex);
}

function toHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function servicePillBackground(hex: string, surfaceHex: string): [number, number, number] {
  const [r, g, b] = parseHex(hex);
  const [sr, sg, sb] = parseHex(surfaceHex);
  const alpha = 0.15;
  return [
    Math.round(r * alpha + sr * (1 - alpha)),
    Math.round(g * alpha + sg * (1 - alpha)),
    Math.round(b * alpha + sb * (1 - alpha)),
  ];
}

/**
 * Darken a hex color until it meets WCAG AA (4.5 : 1) contrast on service pill background.
 * Returns the original color if it already passes.
 */
function ensureContrastOnPillBackground(hex: string, surfaceHex: string, minRatio = 4.5): string {
  const [r, g, b] = parseHex(hex);
  const background = toHex(...servicePillBackground(hex, surfaceHex));
  const contrast = contrastRatio(hex, background);
  if (contrast >= minRatio) return hex;

  const blackContrast = contrastRatio("#000000", background);
  const whiteContrast = contrastRatio("#ffffff", background);
  const target = whiteContrast >= blackContrast ? 255 : 0;
  const blendToTarget = (channel: number, t: number) =>
    Math.round(channel + (target - channel) * t);

  for (let t = 0.02; t <= 1; t += 0.02) {
    const adjusted = toHex(blendToTarget(r, t), blendToTarget(g, t), blendToTarget(b, t));
    if (contrastRatio(adjusted, background) >= minRatio) {
      return adjusted;
    }
  }

  return target === 255 ? "#ffffff" : "#000000";
}

const textColorCache = new Map<string, string>();

/**
 * Returns a WCAG-safe text color derived from the service color.
 * Colors are adjusted toward black or white so they meet 4.5 : 1 contrast on
 * the rendered service pill background over the provided surface color.
 */
export function getServiceTextColor(serviceName: string, surfaceHex = "#ffffff"): string {
  const base = getServiceColor(serviceName);
  const cacheKey = `${base}|${surfaceHex.toLowerCase()}`;
  const cached = textColorCache.get(cacheKey);
  if (cached) return cached;
  const safe = ensureContrastOnPillBackground(base, surfaceHex);
  textColorCache.set(cacheKey, safe);
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

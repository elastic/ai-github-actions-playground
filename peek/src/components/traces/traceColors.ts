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

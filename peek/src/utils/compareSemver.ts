/**
 * Compare two semantic version strings (e.g. "8.9.0" vs "8.10.0").
 * Returns a negative number if a < b, positive if a > b, or 0 if equal.
 * Non-numeric or missing segments are treated as 0.
 */
export function compareSemver(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const diff = (aParts[i] || 0) - (bParts[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

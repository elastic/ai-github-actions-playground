/**
 * Compare two semantic version strings (e.g. "8.9.0" vs "8.10.0").
 * Returns a negative number if a < b, positive if a > b, or 0 if equal.
 * Non-numeric or missing segments are treated as 0.
 */
export function compareSemver(a: string, b: string): number {
  const [aCore, aPre] = splitSemver(a);
  const [bCore, bPre] = splitSemver(b);
  const aParts = aCore.split(".").map(toInt);
  const bParts = bCore.split(".").map(toInt);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const diff = (aParts[i] || 0) - (bParts[i] || 0);
    if (diff !== 0) return diff;
  }
  if (aPre === bPre) return 0;
  if (!aPre) return 1;
  if (!bPre) return -1;
  return comparePrerelease(aPre, bPre);
}

function splitSemver(version: string): [string, string] {
  const normalized = version.split("+", 1)[0] ?? "";
  const [core = "", pre = ""] = normalized.split("-", 2);
  return [core, pre];
}

function toInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function comparePrerelease(a: string, b: string): number {
  const aIdentifiers = a.split(".");
  const bIdentifiers = b.split(".");
  const len = Math.max(aIdentifiers.length, bIdentifiers.length);

  for (let i = 0; i < len; i++) {
    const aIdentifier = aIdentifiers[i];
    const bIdentifier = bIdentifiers[i];
    if (aIdentifier === undefined) return -1;
    if (bIdentifier === undefined) return 1;

    const aIsNumeric = /^\d+$/.test(aIdentifier);
    const bIsNumeric = /^\d+$/.test(bIdentifier);

    if (aIsNumeric && bIsNumeric) {
      const diff = Number(aIdentifier) - Number(bIdentifier);
      if (diff !== 0) return diff;
      continue;
    }
    if (aIsNumeric) return -1;
    if (bIsNumeric) return 1;

    const diff = aIdentifier.localeCompare(bIdentifier);
    if (diff !== 0) return diff;
  }

  return 0;
}

/** Serialize a cell value into a collision-resistant string suitable for cache/row keys. */
export function cellToKeyString(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** Serialize a cell value into a collision-resistant string suitable for cache/row keys. */
export function cellToKeyString(value: unknown): string {
  if (value === null) return "null:null";
  if (value === undefined) return "undefined:undefined";
  if (typeof value === "object") {
    try {
      return `object:${JSON.stringify(value)}`;
    } catch {
      return `object:${String(value)}`;
    }
  }
  return `${typeof value}:${String(value)}`;
}

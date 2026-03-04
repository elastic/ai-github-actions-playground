export function parseBucketTimestampMs(value: unknown, columnType?: string): number | null {
  const fromNumeric = (numeric: number): number => {
    if (columnType === "date_nanos") return numeric / 1_000_000;
    return numeric;
  };

  if (typeof value === "number" && Number.isFinite(value)) {
    return fromNumeric(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      try {
        const asBigInt = BigInt(trimmed);
        const ms = columnType === "date_nanos" ? Number(asBigInt / 1_000_000n) : Number(asBigInt);
        if (Number.isFinite(ms)) return ms;
      } catch {
        const asNumber = Number(trimmed);
        if (Number.isFinite(asNumber)) return fromNumeric(asNumber);
      }
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

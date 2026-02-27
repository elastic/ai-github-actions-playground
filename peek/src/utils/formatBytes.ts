/**
 * Format a byte count into a human-readable string (e.g. "1.2 GB").
 *
 * @param value  Byte count, or `null` for missing data.
 * @param nullLabel  Label returned when `value` is null. Defaults to `"n/a"`.
 */
export function formatBytes(value: number | null, nullLabel = "n/a"): string {
  if (value === null) return nullLabel;
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const normalized = value / Math.pow(1024, exponent);
  return `${normalized.toFixed(normalized >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]!}`;
}

export function normalizeDimensionBucketLabel(value: unknown): string {
  if (value == null) return "unknown";
  const label = String(value).trim();
  return label === "" || label === "-" ? "unknown" : label;
}

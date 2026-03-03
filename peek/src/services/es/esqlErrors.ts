/**
 * Returns true if the ES|QL error is caused by unknown or missing columns.
 * This typically means the index mapping does not include those fields (e.g.
 * an OTel-formatted index missing ECS fields, or vice-versa).
 */
export function isUnknownColumnError(error: string): boolean {
  return (
    error.includes("Unknown column") ||
    /no mapping found for(?: field)?/i.test(error) ||
    /no such column/i.test(error)
  );
}

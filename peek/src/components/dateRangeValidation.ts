export function getCustomRangeValidationError(from: string, to: string): string | null {
  if (!from || !to) return "Select both From and To dates.";

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return "Enter valid date/time values.";
  }
  if (fromDate.getTime() >= toDate.getTime()) {
    return "From must be earlier than To.";
  }
  return null;
}

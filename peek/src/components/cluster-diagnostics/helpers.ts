export type IndicatorStatus = "green" | "yellow" | "red" | "unknown";

export function indicatorStatusColor(
  status: IndicatorStatus | undefined,
): "success" | "warning" | "error" | "default" {
  if (status === "green") return "success";
  if (status === "yellow") return "warning";
  if (status === "red") return "error";
  return "default";
}

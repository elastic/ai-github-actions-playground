import type { HealthSeverity, HealthStatus } from "../../health-checks";

export const STATUS_ORDER: Record<HealthStatus, number> = {
  fail: 0,
  warn: 1,
  unknown: 2,
  pass: 3,
};

export const SEVERITY_ORDER: Record<HealthSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function statusColor(status: HealthStatus): "success" | "warning" | "error" | "default" {
  if (status === "pass") return "success";
  if (status === "warn") return "warning";
  if (status === "fail") return "error";
  return "default";
}

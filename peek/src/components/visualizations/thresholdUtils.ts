import type { ThresholdColor, Thresholds } from "../../types";
import { STATUS_COLORS } from "../../types/tokens";

/** Hex colors for each semantic threshold level, sourced from the unified status palette */
export const THRESHOLD_PALETTE: Record<ThresholdColor, string> = {
  success: STATUS_COLORS.success,
  warning: STATUS_COLORS.warning,
  error: STATUS_COLORS.error,
};

/**
 * Returns the threshold color that applies to `value` based on the configured steps.
 * Steps are evaluated in descending order; the first step whose value ≤ the given value wins.
 * If no step matches, `baseColor` is returned (or undefined if no baseColor is set).
 */
export function resolveThresholdColor(
  value: number,
  thresholds: Thresholds,
): ThresholdColor | undefined {
  const sorted = [...thresholds.steps].sort((a, b) => b.value - a.value);
  const matched = sorted.find((step) => value >= step.value);
  return matched?.color ?? thresholds.baseColor;
}

import type { ThresholdColor, Thresholds } from "../../types";

/** Hex colors for each semantic threshold level, accessible in both light and dark themes */
export const THRESHOLD_PALETTE: Record<ThresholdColor, string> = {
  success: "#54B399",
  warning: "#F5A623",
  error: "#BD271E",
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

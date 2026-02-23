import { describe, it, expect } from "vitest";

import {
  resolveThresholdColor,
  THRESHOLD_PALETTE,
} from "../../src/components/visualizations/thresholdUtils";
import type { Thresholds } from "../../src/types";

describe("resolveThresholdColor", () => {
  it("returns undefined when steps are empty and no baseColor is set", () => {
    const thresholds: Thresholds = { steps: [] };
    expect(resolveThresholdColor(50, thresholds)).toBeUndefined();
  });

  it("returns baseColor when value is below all steps", () => {
    const thresholds: Thresholds = {
      steps: [
        { value: 50, color: "warning" },
        { value: 80, color: "error" },
      ],
      baseColor: "success",
    };
    expect(resolveThresholdColor(10, thresholds)).toBe("success");
    expect(resolveThresholdColor(49, thresholds)).toBe("success");
  });

  it("returns the matching step color when value equals step value", () => {
    const thresholds: Thresholds = {
      steps: [{ value: 50, color: "warning" }],
      baseColor: "success",
    };
    expect(resolveThresholdColor(50, thresholds)).toBe("warning");
  });

  it("returns the highest matching step color when value exceeds multiple steps", () => {
    const thresholds: Thresholds = {
      steps: [
        { value: 50, color: "warning" },
        { value: 80, color: "error" },
      ],
      baseColor: "success",
    };
    expect(resolveThresholdColor(80, thresholds)).toBe("error");
    expect(resolveThresholdColor(99, thresholds)).toBe("error");
  });

  it("returns the intermediate step color when value is between steps", () => {
    const thresholds: Thresholds = {
      steps: [
        { value: 50, color: "warning" },
        { value: 80, color: "error" },
      ],
      baseColor: "success",
    };
    expect(resolveThresholdColor(65, thresholds)).toBe("warning");
  });

  it("handles unsorted steps correctly", () => {
    const thresholds: Thresholds = {
      steps: [
        { value: 80, color: "error" },
        { value: 50, color: "warning" },
      ],
      baseColor: "success",
    };
    expect(resolveThresholdColor(60, thresholds)).toBe("warning");
    expect(resolveThresholdColor(90, thresholds)).toBe("error");
  });

  it("returns undefined when below all steps and no baseColor", () => {
    const thresholds: Thresholds = {
      steps: [{ value: 50, color: "error" }],
    };
    expect(resolveThresholdColor(10, thresholds)).toBeUndefined();
  });

  it("returns step color when above threshold and no baseColor", () => {
    const thresholds: Thresholds = {
      steps: [{ value: 50, color: "error" }],
    };
    expect(resolveThresholdColor(50, thresholds)).toBe("error");
    expect(resolveThresholdColor(100, thresholds)).toBe("error");
  });
});

describe("THRESHOLD_PALETTE", () => {
  it("contains hex color values for success, warning, and error", () => {
    expect(THRESHOLD_PALETTE.success).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(THRESHOLD_PALETTE.warning).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(THRESHOLD_PALETTE.error).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

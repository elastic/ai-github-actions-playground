import { describe, it, expect } from "vitest";

import { severityGlow, severityColor, pulseSx } from "../../src/components/insightSlotSx";

describe("insightSlotSx", () => {
  describe("severityGlow", () => {
    it("returns a blue-tinted glow for info severity", () => {
      expect(severityGlow("info")).toBe("0 0 0 2px rgba(33,150,243,0.18)");
    });

    it("returns an orange-tinted glow for warning severity", () => {
      expect(severityGlow("warning")).toBe("0 0 0 2px rgba(255,152,0,0.22)");
    });

    it("returns a red-tinted glow for critical severity", () => {
      expect(severityGlow("critical")).toBe("0 0 0 2px rgba(244,67,54,0.22)");
    });
  });

  describe("severityColor", () => {
    it("maps info to info.main", () => {
      expect(severityColor("info")).toBe("info.main");
    });

    it("maps warning to warning.main", () => {
      expect(severityColor("warning")).toBe("warning.main");
    });

    it("maps critical to error.main", () => {
      expect(severityColor("critical")).toBe("error.main");
    });
  });

  describe("pulseSx reduced-motion", () => {
    it("defines a pulse keyframe animation", () => {
      expect(pulseSx).toHaveProperty("@keyframes insightPulse");
      expect(pulseSx.animation).toBe("insightPulse 2s ease-in-out infinite");
    });

    it("disables animation when prefers-reduced-motion is set", () => {
      const reducedMotion = pulseSx["@media (prefers-reduced-motion: reduce)"];
      expect(reducedMotion).toBeDefined();
      expect(reducedMotion.animation).toBe("none");
    });
  });
});

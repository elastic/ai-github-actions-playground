import { describe, expect, it } from "vitest";

import { classifyFieldVisual } from "../../src/components/explore/fieldVisuals";

describe("classifyFieldVisual", () => {
  it("classifies resource attributes", () => {
    expect(classifyFieldVisual("resource.attributes.service.name", "unknown")).toBe(
      "resource-attribute",
    );
    expect(classifyFieldVisual("service.name", "unknown")).toBe("resource-attribute");
    expect(classifyFieldVisual("cloud.region", "unknown")).toBe("resource-attribute");
    expect(classifyFieldVisual("deployment.environment.name", "unknown")).toBe(
      "resource-attribute",
    );
    expect(classifyFieldVisual("os.type", "unknown")).toBe("resource-attribute");
  });

  it("classifies generic attributes", () => {
    expect(classifyFieldVisual("attributes.http.method", "unknown")).toBe("attribute");
  });

  it("classifies metric types", () => {
    expect(classifyFieldVisual("system.cpu.total.pct", "gauge")).toBe("metric-gauge");
    expect(classifyFieldVisual("system.network.in.bytes", "counter")).toBe("metric-counter");
  });
});

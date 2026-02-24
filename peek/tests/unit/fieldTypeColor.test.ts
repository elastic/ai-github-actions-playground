import { describe, it, expect } from "vitest";

import { getTypeColor } from "../../src/components/fieldTypeColor";

describe("getTypeColor", () => {
  it("returns warning for date types", () => {
    expect(getTypeColor("date")).toBe("warning");
    expect(getTypeColor("date_nanos")).toBe("warning");
  });

  it("returns primary for numeric types", () => {
    for (const t of ["long", "integer", "double", "float", "short", "byte"]) {
      expect(getTypeColor(t)).toBe("primary");
    }
  });

  it("returns secondary for boolean", () => {
    expect(getTypeColor("boolean")).toBe("secondary");
  });

  it("returns success for keyword/text family", () => {
    for (const t of ["keyword", "text", "ip", "version"]) {
      expect(getTypeColor(t)).toBe("success");
    }
  });

  it("returns default for unknown types", () => {
    expect(getTypeColor("object")).toBe("default");
    expect(getTypeColor("geo_point")).toBe("default");
    expect(getTypeColor("")).toBe("default");
  });
});

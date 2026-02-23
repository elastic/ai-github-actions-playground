import { describe, it, expect } from "vitest";

import { interpolateParameters } from "../../src/services/markdownInterpolation";
import type { DashboardParameter } from "../../src/types";

const makeParam = (
  name: string,
  value: string | number | boolean,
  type: DashboardParameter["type"] = "keyword",
): DashboardParameter => ({
  name,
  label: name,
  type,
  source: { mode: "text" },
  value,
});

describe("interpolateParameters", () => {
  it("replaces a single token", () => {
    const result = interpolateParameters("Owner: {{service}}", [makeParam("service", "web")]);
    expect(result).toBe("Owner: web");
  });

  it("replaces multiple distinct tokens", () => {
    const result = interpolateParameters("{{service}} in {{environment}}", [
      makeParam("service", "api"),
      makeParam("environment", "prod"),
    ]);
    expect(result).toBe("api in prod");
  });

  it("replaces repeated tokens", () => {
    const result = interpolateParameters("{{service}} / {{service}}", [
      makeParam("service", "web"),
    ]);
    expect(result).toBe("web / web");
  });

  it("leaves unknown tokens unchanged", () => {
    const result = interpolateParameters("{{unknown}} stays", [makeParam("service", "web")]);
    expect(result).toBe("{{unknown}} stays");
  });

  it("handles numeric parameter values", () => {
    const result = interpolateParameters("SLO: {{target}}%", [makeParam("target", 99.9, "number")]);
    expect(result).toBe("SLO: 99.9%");
  });

  it("handles boolean parameter values", () => {
    const result = interpolateParameters("Debug: {{debug}}", [makeParam("debug", true, "boolean")]);
    expect(result).toBe("Debug: true");
  });

  it("returns content unchanged when parameters is undefined", () => {
    expect(interpolateParameters("{{service}}", undefined)).toBe("{{service}}");
  });

  it("returns content unchanged when parameters array is empty", () => {
    expect(interpolateParameters("{{service}}", [])).toBe("{{service}}");
  });

  it("returns content unchanged when there are no tokens", () => {
    const result = interpolateParameters("Plain text", [makeParam("service", "web")]);
    expect(result).toBe("Plain text");
  });

  it("does not match tokens with spaces inside braces", () => {
    const result = interpolateParameters("{{ service }}", [makeParam("service", "web")]);
    expect(result).toBe("{{ service }}");
  });
});

import { describe, expect, it } from "vitest";

import { createDefaultPanel } from "../../src/dashboards/panel";

describe("createDefaultPanel", () => {
  it("returns a panel with a unique id", () => {
    const a = createDefaultPanel();
    const b = createDefaultPanel();
    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it("returns expected default values", () => {
    const panel = createDefaultPanel();
    expect(panel.title).toBe("New Panel");
    expect(panel.visualization).toBe("timeseries");
    expect(panel.query).toContain("FROM logs-*");
    expect(panel.layout).toEqual({ x: 0, y: Infinity, w: 6, h: 4 });
  });
});

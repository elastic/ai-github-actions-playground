import { describe, expect, it } from "vitest";

import { createDefaultPanel } from "../../src/dashboards/panel";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("createDefaultPanel", () => {
  it("returns a panel with a unique v4 UUID id", () => {
    const a = createDefaultPanel();
    const b = createDefaultPanel();
    expect(a.id).toMatch(UUID_RE);
    expect(b.id).toMatch(UUID_RE);
    expect(a.id).not.toBe(b.id);
  });

  it("returns expected default values", () => {
    const panel = createDefaultPanel();
    expect(panel.title).toBe("New Panel");
    expect(panel.visualization).toBe("timeseries");
    expect(panel.query).toBe(
      "FROM logs-* | STATS count = COUNT(*) BY @timestamp | SORT @timestamp | LIMIT 50",
    );
    expect(panel.layout).toEqual({ x: 0, y: Infinity, w: 6, h: 4 });
  });
});

import { describe, it, expect } from "vitest";

import { createDefaultDashboard } from "../../src/dashboards/default";

describe("createDefaultDashboard time range bindings", () => {
  it("every panel query references ?_tstart and ?_tend", () => {
    const dashboard = createDefaultDashboard();

    for (const panel of dashboard.panels) {
      expect(panel.query, `Panel "${panel.title}" should reference ?_tstart`).toContain("?_tstart");
      expect(panel.query, `Panel "${panel.title}" should reference ?_tend`).toContain("?_tend");
    }
  });
});

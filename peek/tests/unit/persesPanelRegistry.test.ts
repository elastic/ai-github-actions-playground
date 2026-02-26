import { describe, expect, it } from "vitest";

import { VISUALIZATION_TYPES } from "../../src/components/visualizations/vizRegistry";
import {
  getAllPersesPanelEntries,
  getPersesPanelEntry,
  PERSES_PANEL_TYPES,
} from "../../src/components/perses/panelRegistry";

describe("perses panel registry", () => {
  it("exposes the same ordered panel types as the visualization registry", () => {
    expect([...PERSES_PANEL_TYPES]).toEqual([...VISUALIZATION_TYPES]);
  });

  it("returns entries for every known panel type", () => {
    const entries = getAllPersesPanelEntries();
    const types = entries.map((entry) => entry.type);
    for (const type of PERSES_PANEL_TYPES) {
      expect(types).toContain(type);
      expect(getPersesPanelEntry(type)?.type).toBe(type);
    }
  });
});

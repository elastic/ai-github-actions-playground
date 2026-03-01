import { describe, expect, it } from "vitest";

import { VISUALIZATION_TYPES } from "../../src/components/visualizations/vizRegistry";
import { getAllPersesPanelEntries } from "../../src/components/perses/panelRegistry";
import {
  getPersesDatasourcePlugin,
  registerPersesDatasourcePlugin,
} from "../../src/services/perses/pluginRegistry";
import {
  getPersesPanelPluginKind,
  getVisualizationTypeForPersesPanelKind,
} from "../../src/services/perses/panelPluginKinds";

describe("perses plugin registry", () => {
  it("exposes panel entries for every visualization type", () => {
    const entries = getAllPersesPanelEntries();
    expect(entries.map((entry) => entry.type)).toEqual([...VISUALIZATION_TYPES]);
    for (const visualization of VISUALIZATION_TYPES) {
      expect(entries.some((entry) => entry.type === visualization)).toBe(true);
    }
  });

  it("maps visualization types to perses plugin kinds and back", () => {
    for (const visualization of VISUALIZATION_TYPES) {
      const kind = getPersesPanelPluginKind(visualization);
      expect(kind).toMatch(/\w+/);
      expect(getVisualizationTypeForPersesPanelKind(kind)).toBe(visualization);
    }
    expect(getVisualizationTypeForPersesPanelKind("UnknownPanelKind")).toBeUndefined();
  });

  it("registers the default esql datasource plugin seam", () => {
    const plugin = getPersesDatasourcePlugin("EsqlDatasource");
    expect(plugin?.kind).toBe("EsqlDatasource");
  });

  it("rejects duplicate datasource plugin registration by default", () => {
    const kind = "TestDatasourcePlugin";
    const plugin = {
      kind,
      create: () => ({ execute: async () => ({ columns: [], values: [], executionTimeMs: 0 }) }),
    };

    registerPersesDatasourcePlugin(plugin, { overwrite: true });
    expect(() => registerPersesDatasourcePlugin(plugin)).toThrow(
      `Perses datasource plugin '${kind}' is already registered.`,
    );
  });
});

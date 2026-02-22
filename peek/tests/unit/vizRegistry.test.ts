import { describe, it, expect } from "vitest";

import { getAllVizEntries, getVizEntry } from "../../src/components/visualizations/vizRegistry";
import type { VisualizationType } from "../../src/types";

const ALL_VIZ_TYPES: VisualizationType[] = [
  "timeseries",
  "bar",
  "table",
  "stat",
  "gauge",
  "pie",
  "heatmap",
  "scatter",
  "histogram",
];

describe("vizRegistry", () => {
  describe("getAllVizEntries", () => {
    it("returns an entry for every known visualization type", () => {
      const entries = getAllVizEntries();
      const registeredTypes = entries.map((e) => e.type);
      for (const type of ALL_VIZ_TYPES) {
        expect(registeredTypes).toContain(type);
      }
    });

    it("returns entries in the expected display order", () => {
      const entries = getAllVizEntries();
      expect(entries.map((e) => e.type)).toEqual(ALL_VIZ_TYPES);
    });

    it("every entry has a non-empty label and icon", () => {
      for (const entry of getAllVizEntries()) {
        expect(entry.label.length).toBeGreaterThan(0);
        expect(entry.icon).toBeTruthy();
      }
    });
  });

  describe("getVizEntry", () => {
    it("returns the correct entry for each registered type", () => {
      for (const type of ALL_VIZ_TYPES) {
        const entry = getVizEntry(type);
        expect(entry).toBeDefined();
        expect(entry?.type).toBe(type);
      }
    });

    it("returns undefined for an unknown type", () => {
      expect(getVizEntry("unknown" as VisualizationType)).toBeUndefined();
    });
  });

  describe("defaultOptions", () => {
    it("returns defaults for every registered type without throwing", () => {
      for (const type of ALL_VIZ_TYPES) {
        const entry = getVizEntry(type);
        expect(() => entry?.defaultOptions()).not.toThrow();
      }
    });

    it("timeseries defaults have expected shape", () => {
      expect(getVizEntry("timeseries")?.defaultOptions()).toMatchObject({
        smooth: true,
        showArea: true,
        stacked: false,
      });
    });

    it("bar defaults have expected shape", () => {
      expect(getVizEntry("bar")?.defaultOptions()).toMatchObject({
        stacked: false,
        horizontal: false,
      });
    });

    it("histogram defaults include bins", () => {
      expect(getVizEntry("histogram")?.defaultOptions()).toMatchObject({ bins: 10 });
    });
  });

  describe("supportsOptions", () => {
    it("table does not support options", () => {
      expect(getVizEntry("table")?.supportsOptions).toBe(false);
    });

    it("pie does not support options", () => {
      expect(getVizEntry("pie")?.supportsOptions).toBe(false);
    });

    it("heatmap does not support options", () => {
      expect(getVizEntry("heatmap")?.supportsOptions).toBe(false);
    });

    it("timeseries supports options", () => {
      expect(getVizEntry("timeseries")?.supportsOptions).toBe(true);
    });

    it("bar supports options", () => {
      expect(getVizEntry("bar")?.supportsOptions).toBe(true);
    });

    it("stat supports options", () => {
      expect(getVizEntry("stat")?.supportsOptions).toBe(true);
    });

    it("gauge supports options", () => {
      expect(getVizEntry("gauge")?.supportsOptions).toBe(true);
    });

    it("scatter supports options", () => {
      expect(getVizEntry("scatter")?.supportsOptions).toBe(true);
    });

    it("histogram supports options", () => {
      expect(getVizEntry("histogram")?.supportsOptions).toBe(true);
    });
  });

  describe("OptionsEditor", () => {
    it("timeseries has an OptionsEditor", () => {
      expect(getVizEntry("timeseries")?.OptionsEditor).toBeDefined();
    });

    it("bar has an OptionsEditor", () => {
      expect(getVizEntry("bar")?.OptionsEditor).toBeDefined();
    });

    it("gauge has an OptionsEditor", () => {
      expect(getVizEntry("gauge")?.OptionsEditor).toBeDefined();
    });

    it("histogram has an OptionsEditor", () => {
      expect(getVizEntry("histogram")?.OptionsEditor).toBeDefined();
    });

    it("table has no OptionsEditor", () => {
      expect(getVizEntry("table")?.OptionsEditor).toBeUndefined();
    });

    it("pie has no OptionsEditor", () => {
      expect(getVizEntry("pie")?.OptionsEditor).toBeUndefined();
    });

    it("heatmap has no OptionsEditor", () => {
      expect(getVizEntry("heatmap")?.OptionsEditor).toBeUndefined();
    });

    // stat and scatter show format options (supportsOptions: true) but have no
    // type-specific controls beyond the shared FormatEditor.
    it("stat has no type-specific OptionsEditor (format-only)", () => {
      expect(getVizEntry("stat")?.OptionsEditor).toBeUndefined();
    });

    it("scatter has no type-specific OptionsEditor (format-only)", () => {
      expect(getVizEntry("scatter")?.OptionsEditor).toBeUndefined();
    });
  });
});

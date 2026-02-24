import { describe, it, expect } from "vitest";

import {
  getAllVizEntries,
  getVizEntry,
  VISUALIZATION_TYPES,
} from "../../src/components/visualizations/vizRegistry";
import type { VisualizationType } from "../../src/types";

describe("vizRegistry", () => {
  describe("getAllVizEntries", () => {
    it("returns an entry for every known visualization type", () => {
      const entries = getAllVizEntries();
      const registeredTypes = entries.map((e) => e.type);
      for (const type of VISUALIZATION_TYPES) {
        expect(registeredTypes).toContain(type);
      }
    });

    it("contains no duplicate type keys", () => {
      const entries = getAllVizEntries();
      const types = entries.map((e) => e.type);
      expect(new Set(types).size).toBe(types.length);
    });

    it("VISUALIZATION_TYPES matches the registry entry order", () => {
      const entries = getAllVizEntries();
      expect(entries.map((e) => e.type)).toEqual([...VISUALIZATION_TYPES]);
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
      for (const type of VISUALIZATION_TYPES) {
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
      for (const type of VISUALIZATION_TYPES) {
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
    it("pie does not support options", () => {
      expect(getVizEntry("pie")?.supportsOptions).toBe(false);
    });

    it("heatmap does not support options", () => {
      expect(getVizEntry("heatmap")?.supportsOptions).toBe(false);
    });

    it("markdown does not support options", () => {
      expect(getVizEntry("markdown")?.supportsOptions).toBe(false);
    });

    it("timeseries supports options", () => {
      expect(getVizEntry("timeseries")?.supportsOptions).toBe(true);
    });

    it("bar supports options", () => {
      expect(getVizEntry("bar")?.supportsOptions).toBe(true);
    });

    it("table supports options (threshold controls)", () => {
      expect(getVizEntry("table")?.supportsOptions).toBe(true);
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

  describe("supportsQuery", () => {
    it("markdown does not support query (static content)", () => {
      expect(getVizEntry("markdown")?.supportsQuery).toBe(false);
    });

    it("all other types support query", () => {
      const queryTypes = VISUALIZATION_TYPES.filter((type) => type !== "markdown");
      for (const type of queryTypes) {
        expect(getVizEntry(type)?.supportsQuery).toBe(true);
      }
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

    it("table has an OptionsEditor (threshold controls)", () => {
      expect(getVizEntry("table")?.OptionsEditor).toBeDefined();
    });

    it("stat has an OptionsEditor (threshold controls)", () => {
      expect(getVizEntry("stat")?.OptionsEditor).toBeDefined();
    });

    it("pie has no OptionsEditor", () => {
      expect(getVizEntry("pie")?.OptionsEditor).toBeUndefined();
    });

    it("heatmap has no OptionsEditor", () => {
      expect(getVizEntry("heatmap")?.OptionsEditor).toBeUndefined();
    });

    it("scatter has no type-specific OptionsEditor (format-only)", () => {
      expect(getVizEntry("scatter")?.OptionsEditor).toBeUndefined();
    });
  });
});

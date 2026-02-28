import { describe, expect, it } from "vitest";

import {
  fromReactGridLayoutItems,
  toPersesPanelLayouts,
  toReactGridLayouts,
} from "../../src/components/perses/layoutAdapter";

describe("perses layout adapter", () => {
  it("preserves layout coordinates when adapting between models", () => {
    const persesLayouts = toPersesPanelLayouts([
      {
        id: "panel-1",
        title: "Panel 1",
        query: "FROM logs-* | LIMIT 1",
        visualization: "timeseries",
        layout: { x: 1, y: 2, w: 6, h: 4 },
      },
    ]);
    const reactLayouts = toReactGridLayouts(persesLayouts);
    expect(reactLayouts.lg).toEqual(
      expect.arrayContaining([expect.objectContaining({ i: "panel-1", x: 1, y: 2, w: 6, h: 4 })]),
    );
    const roundTrip = fromReactGridLayoutItems(reactLayouts.lg ?? []);
    expect(roundTrip).toEqual([{ id: "panel-1", x: 1, y: 2, w: 6, h: 4 }]);
  });
});

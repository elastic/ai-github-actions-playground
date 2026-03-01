import type { PanelDefinition } from "../types";

/** Create a default panel definition for "Add Panel" actions. */
export function createDefaultPanel(): PanelDefinition {
  return {
    id: crypto.randomUUID(),
    title: "New Panel",
    query: "FROM logs-* | STATS count = COUNT(*) BY @timestamp | SORT @timestamp | LIMIT 50",
    visualization: "timeseries" as const,
    layout: { x: 0, y: Infinity, w: 6, h: 4 },
  };
}

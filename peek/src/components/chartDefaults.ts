import type { VisualizationOptions, VisualizationType } from "../types";

import { getVizEntry } from "./visualizations/vizRegistry";

export function defaultOptions(vizType: VisualizationType): VisualizationOptions {
  const entry = getVizEntry(vizType);
  if (!entry) throw new Error(`Unsupported visualization type: ${vizType}`);
  return entry.defaultOptions();
}

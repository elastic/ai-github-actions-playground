import type { VisualizationOptions, VisualizationType } from "../types";

import { getPersesPanelEntry } from "./perses/panelRegistry";

export function defaultOptions(vizType: VisualizationType): VisualizationOptions {
  const entry = getPersesPanelEntry(vizType);
  if (!entry) throw new Error(`Unsupported visualization type: ${vizType}`);
  return entry.defaultOptions();
}

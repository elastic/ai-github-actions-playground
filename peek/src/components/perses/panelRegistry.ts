import type { VisualizationType } from "../../types";
import {
  getAllVizEntries,
  getVizEntry,
  VISUALIZATION_TYPES,
  type VizRegistryEntry,
} from "../visualizations/vizRegistry";

export type PersesPanelEntry = VizRegistryEntry;

export const PERSES_PANEL_TYPES = VISUALIZATION_TYPES;

export function getPersesPanelEntry(type: VisualizationType): PersesPanelEntry | undefined {
  return getVizEntry(type);
}

export function getAllPersesPanelEntries(): readonly PersesPanelEntry[] {
  return getAllVizEntries();
}

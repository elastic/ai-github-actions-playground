import type { VisualizationType } from "../../types";
import type { VizRegistryDescriptor, VizRegistryEntry } from "../visualizations/vizRegistry";

export type PersesPanelEntry = VizRegistryEntry;

const panelRegistryModules = import.meta.glob<{ default: VizRegistryDescriptor }>(
  "../visualizations/registry/*.tsx",
  { eager: true },
);

const persesPanelEntries = Object.values(panelRegistryModules)
  .map((module) => module.default)
  .sort((a, b) => a.order - b.order)
  .map((descriptor) => descriptor.entry);

if (persesPanelEntries.length === 0) {
  throw new Error("Perses panel registry is empty.");
}

export const PERSES_PANEL_TYPES = persesPanelEntries.map((entry) => entry.type) as [
  VisualizationType,
  ...VisualizationType[],
];

export function getPersesPanelEntry(type: VisualizationType): PersesPanelEntry | undefined {
  return persesPanelEntries.find((entry) => entry.type === type);
}

export function getAllPersesPanelEntries(): readonly PersesPanelEntry[] {
  return persesPanelEntries;
}

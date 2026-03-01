import type { VisualizationType } from "../../types";
import type { VizRegistryEntry } from "../visualizations/vizRegistry";
import { getPersesPanelPluginKind } from "../../services/perses/panelPluginKinds";

export type PersesPanelEntry = VizRegistryEntry;

const panelRegistryModules = import.meta.glob<{
  default: { order: number; entry: VizRegistryEntry };
}>("../visualizations/registry/*.tsx", { eager: true });

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
  return getPersesPanelEntryByPluginKind(getPersesPanelPluginKind(type));
}

export function getPersesPanelEntryByPluginKind(kind: string): PersesPanelEntry | undefined {
  return persesPanelEntries.find((entry) => getPersesPanelPluginKind(entry.type) === kind);
}

export function getAllPersesPanelEntries(): readonly PersesPanelEntry[] {
  return persesPanelEntries;
}

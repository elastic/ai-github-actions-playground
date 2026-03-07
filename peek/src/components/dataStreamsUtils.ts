import type { FieldCapsResponse } from "../services/es";

import { DATA_STREAMS_INSIGHT_SLOT_IDS } from "./dataStreamsInsightSlots";

export type StreamSortField = "name" | "status" | "indices";
export type StreamSortDirection = "asc" | "desc";

type StreamStatus = "GREEN" | "YELLOW" | "RED";

export const STATUS_CHIP_COLORS: Readonly<Record<StreamStatus, "success" | "warning" | "error">> = {
  GREEN: "success",
  YELLOW: "warning",
  RED: "error",
};

export function getStatusChipColor(status: string): "success" | "warning" | "error" | "default" {
  return STATUS_CHIP_COLORS[status.toUpperCase() as StreamStatus] ?? "default";
}

export const STREAM_STATUS_ORDER: Record<string, number> = { GREEN: 0, YELLOW: 1, RED: 2 };

export function toFieldRows(fieldCaps: FieldCapsResponse) {
  return Object.entries(fieldCaps.fields ?? {})
    .flatMap(([name, capabilities]) =>
      Object.values(capabilities).map((cap) => ({ name, type: cap.type })),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type));
}

// ---------------------------------------------------------------------------
// Overview card helpers
// ---------------------------------------------------------------------------

export const OVERVIEW_CARD_DEFS = [
  { slotId: DATA_STREAMS_INSIGHT_SLOT_IDS.totalStreamsCard, key: "total", title: "Total Streams" },
  { slotId: DATA_STREAMS_INSIGHT_SLOT_IDS.healthyCard, key: "healthy", title: "Healthy" },
  { slotId: DATA_STREAMS_INSIGHT_SLOT_IDS.degradedCard, key: "degraded", title: "Degraded" },
  { slotId: DATA_STREAMS_INSIGHT_SLOT_IDS.unhealthyCard, key: "unhealthy", title: "Unhealthy" },
  {
    slotId: DATA_STREAMS_INSIGHT_SLOT_IDS.backingIndicesCard,
    key: "backingIndices",
    title: "Backing Indices",
  },
] as const;
export type OverviewCardKey = (typeof OVERVIEW_CARD_DEFS)[number]["key"];

export type StreamMetrics = {
  total: number;
  green: number;
  yellow: number;
  red: number;
  totalIndices: number;
};

export function getCardValue(
  key: OverviewCardKey,
  m: StreamMetrics,
): { value: number; color?: string } {
  switch (key) {
    case "total":
      return { value: m.total };
    case "healthy":
      return { value: m.green, color: "success.main" };
    case "degraded":
      return { value: m.yellow, color: m.yellow > 0 ? "warning.main" : "text.primary" };
    case "unhealthy":
      return { value: m.red, color: m.red > 0 ? "error.main" : "text.primary" };
    case "backingIndices":
      return { value: m.totalIndices };
  }
}

export function compareStreams(
  a: { name: string; status: string; indices: unknown[] },
  b: { name: string; status: string; indices: unknown[] },
  field: StreamSortField,
  dir: StreamSortDirection,
): number {
  let cmp: number;
  switch (field) {
    case "name":
      cmp = a.name.localeCompare(b.name);
      break;
    case "status":
      cmp =
        (STREAM_STATUS_ORDER[a.status.toUpperCase()] ?? 99) -
        (STREAM_STATUS_ORDER[b.status.toUpperCase()] ?? 99);
      if (cmp === 0) cmp = a.name.localeCompare(b.name);
      break;
    case "indices":
      cmp = a.indices.length - b.indices.length;
      if (cmp === 0) cmp = a.name.localeCompare(b.name);
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

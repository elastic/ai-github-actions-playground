import type { InsightSlotDefinition } from "../types/insightSlots";

export const DATA_STREAMS_INSIGHT_SLOT_IDS = {
  streamSearch: "data-streams-search",
  totalStreamsCard: "data-streams-total-streams-card",
  healthyCard: "data-streams-healthy-card",
  degradedCard: "data-streams-degraded-card",
  unhealthyCard: "data-streams-unhealthy-card",
  backingIndicesCard: "data-streams-backing-indices-card",
  streamList: "data-streams-list",
  streamDetail: "data-streams-detail",
} as const;

export const DATA_STREAMS_INSIGHT_SLOTS: InsightSlotDefinition[] = [
  {
    slotId: DATA_STREAMS_INSIGHT_SLOT_IDS.streamSearch,
    label: "Data streams search and filter controls",
  },
  {
    slotId: DATA_STREAMS_INSIGHT_SLOT_IDS.totalStreamsCard,
    label: "KPI card: total number of data streams",
  },
  {
    slotId: DATA_STREAMS_INSIGHT_SLOT_IDS.healthyCard,
    label: "KPI card: count of streams with GREEN status",
  },
  {
    slotId: DATA_STREAMS_INSIGHT_SLOT_IDS.degradedCard,
    label: "KPI card: count of streams with YELLOW status",
  },
  {
    slotId: DATA_STREAMS_INSIGHT_SLOT_IDS.unhealthyCard,
    label: "KPI card: count of streams with RED status",
  },
  {
    slotId: DATA_STREAMS_INSIGHT_SLOT_IDS.backingIndicesCard,
    label: "KPI card: total backing indices across all streams",
  },
  {
    slotId: DATA_STREAMS_INSIGHT_SLOT_IDS.streamList,
    label: "Data stream list table with name, status, and backing index count",
  },
  {
    slotId: DATA_STREAMS_INSIGHT_SLOT_IDS.streamDetail,
    label: "Selected stream detail: metadata, field list, and field stats",
  },
];

import type { InsightSlotDefinition } from "../types/insightSlots";

export const INDICES_INSIGHT_SLOT_IDS = {
  indexSearch: "indices-search",
  totalIndicesCard: "indices-total-indices-card",
  healthyCard: "indices-healthy-card",
  degradedCard: "indices-degraded-card",
  unhealthyCard: "indices-unhealthy-card",
  totalDocsCard: "indices-total-docs-card",
  totalSizeCard: "indices-total-size-card",
  indexList: "indices-list",
  indexDetail: "indices-detail",
} as const;

export const INDICES_INSIGHT_SLOTS: InsightSlotDefinition[] = [
  {
    slotId: INDICES_INSIGHT_SLOT_IDS.indexSearch,
    label: "Indices search and filter controls",
  },
  {
    slotId: INDICES_INSIGHT_SLOT_IDS.totalIndicesCard,
    label: "KPI card: total number of indices",
  },
  {
    slotId: INDICES_INSIGHT_SLOT_IDS.healthyCard,
    label: "KPI card: count of indices with green health",
  },
  {
    slotId: INDICES_INSIGHT_SLOT_IDS.degradedCard,
    label: "KPI card: count of indices with yellow health",
  },
  {
    slotId: INDICES_INSIGHT_SLOT_IDS.unhealthyCard,
    label: "KPI card: count of indices with red health",
  },
  {
    slotId: INDICES_INSIGHT_SLOT_IDS.totalDocsCard,
    label: "KPI card: total document count across all indices",
  },
  {
    slotId: INDICES_INSIGHT_SLOT_IDS.totalSizeCard,
    label: "KPI card: total store size across all indices",
  },
  {
    slotId: INDICES_INSIGHT_SLOT_IDS.indexList,
    label: "Index list table with name, health, docs, and size",
  },
  {
    slotId: INDICES_INSIGHT_SLOT_IDS.indexDetail,
    label: "Selected index detail: overview, mappings, settings, stats, disk usage",
  },
];

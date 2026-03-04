import type { InsightSlotDefinition } from "../../types/insightSlots";

import type { ServiceRow } from "./serviceInventoryHelpers";

export const SERVICE_INSIGHT_SLOT_IDS = {
  serviceSearch: "service-search",
  totalServicesCard: "service-total-services-card",
  totalRequestsCard: "service-total-requests-card",
  avgLatencyCard: "service-avg-latency-card",
  errorRateCard: "service-error-rate-card",
  slowestServicesPanel: "service-slowest-services-panel",
  highestErrorRatePanel: "service-highest-error-rate-panel",
  languageDistributionPanel: "service-language-distribution-panel",
  environmentDistributionPanel: "service-environment-distribution-panel",
  serviceInventory: "service-inventory",
} as const;

const SERVICE_ROW_SLOT_PREFIX = "service-inventory-row";
const SLOWEST_ROW_SLOT_PREFIX = "service-slowest-row";
const ERROR_RATE_ROW_SLOT_PREFIX = "service-highest-error-row";

export function serviceRowInsightSlotId(serviceName: string): string {
  return `${SERVICE_ROW_SLOT_PREFIX}:${encodeURIComponent(serviceName)}`;
}

export function buildServiceRowInsightSlots(
  rows: ServiceRow[],
  limit: number,
): InsightSlotDefinition[] {
  return rows.slice(0, limit).map((row) => ({
    slotId: serviceRowInsightSlotId(row.serviceName),
    label:
      `Service inventory row for ${row.serviceName}. ` +
      `Requests=${row.requestCount}, avgLatencyMs=${row.avgLatencyMs.toFixed(1)}, ` +
      `errorRate=${(row.errorRate * 100).toFixed(1)}%, language=${row.language}, ` +
      `environment=${row.environment}, topError=${row.topError}.`,
  }));
}

export function slowestServiceRowInsightSlotId(serviceName: string): string {
  return `${SLOWEST_ROW_SLOT_PREFIX}:${encodeURIComponent(serviceName)}`;
}

export function highestErrorServiceRowInsightSlotId(serviceName: string): string {
  return `${ERROR_RATE_ROW_SLOT_PREFIX}:${encodeURIComponent(serviceName)}`;
}

export function buildSlowestServiceRowInsightSlots(
  rows: ServiceRow[],
  limit: number,
): InsightSlotDefinition[] {
  return [...rows]
    .sort((a, b) => b.avgLatencyMs - a.avgLatencyMs)
    .slice(0, limit)
    .map((row) => ({
      slotId: slowestServiceRowInsightSlotId(row.serviceName),
      label:
        `Slowest services row for ${row.serviceName}. ` +
        `Avg latency=${row.avgLatencyMs.toFixed(1)}ms, requests=${row.requestCount}, ` +
        `errorRate=${(row.errorRate * 100).toFixed(1)}%.`,
    }));
}

export function buildHighestErrorServiceRowInsightSlots(
  rows: ServiceRow[],
  limit: number,
): InsightSlotDefinition[] {
  return [...rows]
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, limit)
    .map((row) => ({
      slotId: highestErrorServiceRowInsightSlotId(row.serviceName),
      label:
        `Highest error-rate services row for ${row.serviceName}. ` +
        `Error rate=${(row.errorRate * 100).toFixed(1)}%, avg latency=${row.avgLatencyMs.toFixed(1)}ms, ` +
        `requests=${row.requestCount}, topError=${row.topError}.`,
    }));
}

export const SERVICE_INSIGHT_SLOTS: InsightSlotDefinition[] = [
  {
    slotId: SERVICE_INSIGHT_SLOT_IDS.serviceSearch,
    label: "Service performance controls: time range, search trigger, and result count summary",
  },
  {
    slotId: SERVICE_INSIGHT_SLOT_IDS.totalServicesCard,
    label: "KPI card: total number of discovered services in scope",
  },
  {
    slotId: SERVICE_INSIGHT_SLOT_IDS.totalRequestsCard,
    label: "KPI card: total request volume across services",
  },
  {
    slotId: SERVICE_INSIGHT_SLOT_IDS.avgLatencyCard,
    label: "KPI card: weighted average service latency",
  },
  {
    slotId: SERVICE_INSIGHT_SLOT_IDS.errorRateCard,
    label: "KPI card: overall service error rate",
  },
  {
    slotId: SERVICE_INSIGHT_SLOT_IDS.slowestServicesPanel,
    label: "Ranked panel: slowest services by average latency",
  },
  {
    slotId: SERVICE_INSIGHT_SLOT_IDS.highestErrorRatePanel,
    label: "Ranked panel: services with the highest error rate",
  },
  {
    slotId: SERVICE_INSIGHT_SLOT_IDS.languageDistributionPanel,
    label: "Distribution panel: services by language/runtime",
  },
  {
    slotId: SERVICE_INSIGHT_SLOT_IDS.environmentDistributionPanel,
    label: "Distribution panel: services by environment",
  },
  {
    slotId: SERVICE_INSIGHT_SLOT_IDS.serviceInventory,
    label: "Service inventory table with request volume, latency, errors, and metadata breakdown",
  },
];

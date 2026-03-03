import { escapeEsqlString } from "../../services/es/esqlUtils";
import { buildPipeline, buildWherePipe } from "../../services/es/queryParts";

import type { InvestigateTab } from "./investigateUtils";

const INVESTIGATE_INDICES = "logs-*, .ds-logs-*, filebeat-*, auditbeat-*, winlogbeat-*";

/** Build an ES|QL query to fetch recent events for a given user or host. */
export function buildInvestigateQuery(tab: InvestigateTab, entity: string): string {
  const field = tab === "user" ? "user.name" : "host.name";
  return buildPipeline([
    `FROM ${INVESTIGATE_INDICES}`,
    buildWherePipe([`${field} == "${escapeEsqlString(entity)}"`]),
    "SORT @timestamp DESC",
    "LIMIT 200",
  ]);
}

/** Build an ES|QL query to discover recent distinct users or hosts. */
export function buildRecentEntitiesQuery(tab: InvestigateTab): string {
  const field = tab === "user" ? "user.name" : "host.name";
  return buildPipeline([
    `FROM ${INVESTIGATE_INDICES}`,
    buildWherePipe([`${field} IS NOT NULL`]),
    `STATS event_count = COUNT(*), last_seen = MAX(@timestamp) BY ${field}`,
    "SORT last_seen DESC",
    "LIMIT 10",
  ]);
}

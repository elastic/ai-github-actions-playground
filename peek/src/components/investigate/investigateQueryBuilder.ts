import { escapeEsqlString } from "../../services/es/esqlUtils";
import { buildPipeline, buildWherePipe } from "../../services/es/queryParts";

import type { InvestigateTab } from "./investigateUtils";

const INVESTIGATE_INDICES = "logs-*, .ds-logs-*, filebeat-*, auditbeat-*, winlogbeat-*";

const INVESTIGATE_KEEP_FIELDS =
  "@timestamp, event.category, event.action, event.outcome, user.name, host.name, source.ip, message, _index";

/** Map each investigate tab to its primary ECS field. */
export function investigateField(tab: InvestigateTab): string {
  switch (tab) {
    case "user":
      return "user.name";
    case "host":
      return "host.name";
    case "ip":
      return "source.ip";
    case "domain":
      return "url.domain";
    case "file":
      return "file.name";
  }
}

/** Build an ES|QL query to fetch recent events for a given entity. */
export function buildInvestigateQuery(tab: InvestigateTab, entity: string): string {
  const field = investigateField(tab);
  return buildPipeline([
    `FROM ${INVESTIGATE_INDICES} METADATA _index`,
    buildWherePipe([`${field} == "${escapeEsqlString(entity)}"`]),
    "SORT @timestamp DESC",
    `KEEP ${INVESTIGATE_KEEP_FIELDS}`,
    "LIMIT 200",
  ]);
}

/** Build an ES|QL query to discover recent distinct entities. */
export function buildRecentEntitiesQuery(tab: InvestigateTab): string {
  const field = investigateField(tab);
  return buildPipeline([
    `FROM ${INVESTIGATE_INDICES}`,
    buildWherePipe([`${field} IS NOT NULL`]),
    `STATS event_count = COUNT(*), last_seen = MAX(@timestamp) BY ${field}`,
    "SORT last_seen DESC",
    "LIMIT 10",
  ]);
}

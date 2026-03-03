import { escapeEsqlString } from "../../services/es/esqlUtils";
import { buildPipeline, buildWherePipe } from "../../services/es/queryParts";

import { INVESTIGATE_TIMELINE_FIELDS } from "./investigateSchema";
import type { InvestigateTab } from "./investigateUtils";

const INVESTIGATE_INDICES = "logs-*, .ds-logs-*, filebeat-*, auditbeat-*, winlogbeat-*";

const FILE_MATCH_FIELDS = ["file.name", "file.hash.md5", "file.hash.sha1", "file.hash.sha256"];

/**
 * Query flavor controls which KEEP fields are requested.
 * - "full": all ECS + common fields (default)
 * - "otel": drops ECS-specific fields not present in OTel indices
 * - "minimal": only universally-safe fields (`@timestamp`, message, _index)
 */
export type QueryFlavor = "full" | "otel" | "minimal";

/** Ordered fallback chain: try each flavor in sequence on column errors. */
export const QUERY_FLAVOR_CHAIN: QueryFlavor[] = ["full", "otel", "minimal"];

/** KEEP fields per flavor. */
const FLAVOR_KEEP_FIELDS: Record<QueryFlavor, string> = {
  full: INVESTIGATE_TIMELINE_FIELDS.join(", "),
  otel: "@timestamp, host.name, message, _index",
  minimal: "@timestamp, message, _index",
};

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
export function buildInvestigateQuery(
  tab: InvestigateTab,
  entity: string,
  flavor: QueryFlavor = "full",
): string {
  const field = investigateField(tab);
  const escapedEntity = escapeEsqlString(entity);
  const predicate =
    tab === "file"
      ? `(${FILE_MATCH_FIELDS.map((matchField) => `${matchField} == "${escapedEntity}"`).join(" OR ")})`
      : `${field} == "${escapedEntity}"`;
  return buildPipeline([
    `FROM ${INVESTIGATE_INDICES} METADATA _index`,
    buildWherePipe([predicate]),
    "SORT @timestamp DESC",
    `KEEP ${FLAVOR_KEEP_FIELDS[flavor]}`,
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

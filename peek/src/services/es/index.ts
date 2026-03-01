export { ElasticsearchClient, isElasticsearchError } from "./client";
export { executeRawRequest } from "./rawRequest";
export type { DoFetch, RawRequestError } from "./rawRequest";
export { buildEsqlRequest } from "./buildEsqlRequest";
export type { BuildEsqlRequestOptions } from "./buildEsqlRequest";
export { fetchCapabilitiesForConnection } from "./connectionHandshake";

// ---------------------------------------------------------------------------
// Core client types (connection, error shapes)
// ---------------------------------------------------------------------------

export type { ElasticsearchConnection, ElasticsearchError, EsqlError } from "./client";

// ---------------------------------------------------------------------------
// Domain-specific types — each module owns its own types so that new endpoint
// additions only require editing the relevant domain file.
// ---------------------------------------------------------------------------

export type * from "./esqlTypes";
export type * from "./clusterTypes";
export type * from "./indicesTypes";
export type * from "./securityTypes";
export type * from "./ingestTypes";
export type * from "./profilingTypes";

export {
  buildExplorerQuery,
  buildOverviewQuery,
  buildDimensionOverviewQuery,
  getDefaultAggregation,
  getAggregationOptions,
} from "./queryBuilder";
export type {
  MetricType,
  AggregationType,
  ExplorerFilter,
  ExplorerQuery,
  ExplorerQueryResult,
  OverviewQuery,
  DimensionOverviewQuery,
} from "./queryBuilder";

export { classifyMetricType, listFields, getFieldValues, getFieldCardinality } from "./metadata";
export type { MetricTypeClassification, FieldInfo, FieldValueEntry } from "./metadata";
export {
  isKeywordLikeType,
  isNumericOrDateType,
  buildFieldStatsQuery,
  buildTopValuesQuery,
  buildMinMaxQuery,
  fetchFieldStats,
  computeConfidenceLevel,
} from "./fieldStats";
export type { FieldTopValue, FieldStats, ConfidenceLevel } from "./fieldStats";

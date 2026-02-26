export { ElasticsearchClient, isElasticsearchError } from "./client";
export { fetchCapabilitiesForConnection } from "./connectionHandshake";
export type {
  ElasticsearchConnection,
  ElasticsearchError,
  EsqlError,
  EsqlColumn,
  EsqlResult,
  EsqlResponse,
  AsyncEsqlResult,
  EsqlQueryRequest,
  EsqlQueryParams,
  EsqlQueryResponse,
  ClusterInfoResponse,
  ClusterHealthResponse,
  ClusterStatsResponse,
  NodesInfoNode,
  NodesInfoResponse,
  NodeStatsNode,
  NodesStatsResponse,
  ResolveIndexResponse,
  GetDataStreamsResponse,
  DataStreamInfo,
  ResolveIndexDataStreamInfo,
  FieldCapsResponse,
  FieldCapability,
  SecurityUser,
  SecurityRole,
  GetSecurityUsersResponse,
  GetSecurityRolesResponse,
  UserCapabilities,
  ProfilingTopFunctionsRequest,
  IngestPipeline,
  GetIngestPipelinesResponse,
  SimulateIngestPipelineResponse,
} from "./client";

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

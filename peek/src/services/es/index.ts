export { ElasticsearchClient, isElasticsearchError } from "./client";
export { executeRawRequest } from "./rawRequest";
export type { DoFetch, RawRequestError } from "./rawRequest";
export { validateResponse } from "./responseSchemas";
export { buildEsqlRequest } from "./buildEsqlRequest";
export type { BuildEsqlRequestOptions } from "./buildEsqlRequest";
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
  ClusterPendingTask,
  ClusterPendingTasksResponse,
  CatAllocationRecord,
  CatShardRecord,
  ClusterStatsResponse,
  NodesInfoNode,
  NodesInfoResponse,
  NodeStatsNode,
  NodesStatsResponse,
  RecoveryResponse,
  IlmExplainResponse,
  SlmStatsResponse,
  SnapshotStatusResponse,
  NodesIngestStatsResponse,
  ClusterSettingsResponse,
  ClusterAllocationExplainResponse,
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
  ApiKeyInfo,
  GetApiKeysResponse,
  ProfilingTopFunctionsRequest,
  CatIndexRecord,
  IndexStatsData,
  IndexStatsResponse,
  DiskUsageFieldStats,
  DiskUsageIndexEntry,
  DiskUsageResponse,
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

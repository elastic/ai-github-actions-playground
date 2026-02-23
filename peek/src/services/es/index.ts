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
  ResolveIndexResponse,
  GetDataStreamsResponse,
  DataStreamInfo,
  ResolveIndexDataStreamInfo,
  FieldCapsResponse,
  FieldCapability,
  UserCapabilities,
} from "./client";

export { buildExplorerQuery, getDefaultAggregation, getAggregationOptions } from "./queryBuilder";
export type {
  MetricType,
  AggregationType,
  ExplorerFilter,
  ExplorerQuery,
  ExplorerQueryResult,
} from "./queryBuilder";

export { classifyMetricType, listFields, getFieldValues, getFieldCardinality } from "./metadata";
export type { MetricTypeClassification, FieldInfo, FieldValueEntry } from "./metadata";

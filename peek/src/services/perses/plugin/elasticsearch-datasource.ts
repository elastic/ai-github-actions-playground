import type { DatasourcePlugin, DatasourceClient } from "@perses-dev/plugin-system";

import { ElasticsearchClient } from "../../es";
import type { ElasticsearchConnection, EsqlQueryParams, EsqlQueryResponse } from "../../es";

/**
 * Spec for the Elasticsearch datasource plugin.
 * Matches the subset of ElasticsearchConnection used by the ES|QL client.
 */
export interface ElasticsearchDatasourceSpec {
  /** Elasticsearch base URL (e.g. "https://localhost:9200"). */
  url: string;
  /** API key for authentication. */
  apiKey?: string;
  /** Basic-auth username. */
  username?: string;
  /** Basic-auth password. */
  password?: string;
}

/**
 * Client returned by the Elasticsearch datasource plugin.
 * Wraps an ElasticsearchClient to expose a typed ES|QL query method.
 */
export interface ElasticsearchDatasourceClient extends DatasourceClient {
  kind: "ElasticsearchDatasource";
  query(
    params: EsqlQueryParams,
    signal?: AbortSignal,
  ): Promise<EsqlQueryResponse & { executionTimeMs: number }>;
  getConnection(): ElasticsearchConnection;
}

function toConnection(spec: ElasticsearchDatasourceSpec): ElasticsearchConnection {
  return {
    url: spec.url,
    apiKey: spec.apiKey,
    username: spec.username,
    password: spec.password,
  };
}

/**
 * Perses DatasourcePlugin for Elasticsearch.
 *
 * Registers under the kind `"ElasticsearchDatasource"` and creates an
 * `ElasticsearchDatasourceClient` from a connection spec containing host
 * and credentials.
 */
export const ElasticsearchDatasource: DatasourcePlugin<
  ElasticsearchDatasourceSpec,
  ElasticsearchDatasourceClient
> = {
  createInitialOptions: () => ({ url: "https://localhost:9200" }),

  createClient(spec: ElasticsearchDatasourceSpec): ElasticsearchDatasourceClient {
    const connection = toConnection(spec);
    const client = new ElasticsearchClient(connection);
    return {
      kind: "ElasticsearchDatasource",
      query: (params, signal) => client.query(params, signal),
      healthCheck: async () => {
        try {
          await client.query({ query: "ROW ok = true" });
          return true;
        } catch {
          return false;
        }
      },
      getConnection: () => connection,
    };
  },
};

export const ELASTICSEARCH_DATASOURCE_KIND = "ElasticsearchDatasource";

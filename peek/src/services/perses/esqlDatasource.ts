import { ElasticsearchClient } from "../es";
import type { ElasticsearchConnection, EsqlQueryParams, EsqlQueryResponse } from "../es";

export interface PersesEsqlDatasource {
  execute(
    request: EsqlQueryParams,
    signal?: AbortSignal,
  ): Promise<EsqlQueryResponse & { executionTimeMs: number }>;
}

export function createPersesEsqlDatasource(
  connection: ElasticsearchConnection,
): PersesEsqlDatasource {
  const client = new ElasticsearchClient(connection);
  return {
    execute: (request, signal) => client.query(request, signal),
  };
}

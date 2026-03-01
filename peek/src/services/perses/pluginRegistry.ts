import { ElasticsearchClient } from "../es";
import type { ElasticsearchConnection, EsqlQueryParams, EsqlQueryResponse } from "../es";

export interface PersesDatasourcePlugin<TDatasource> {
  kind: string;
  create(connection: ElasticsearchConnection): TDatasource;
}

type EsqlDatasource = {
  execute(
    request: EsqlQueryParams,
    signal?: AbortSignal,
  ): Promise<EsqlQueryResponse & { executionTimeMs: number }>;
};

const datasourcePlugins = new Map<string, PersesDatasourcePlugin<unknown>>();

const esqlDatasourcePlugin: PersesDatasourcePlugin<EsqlDatasource> = {
  kind: "EsqlDatasource",
  create(connection) {
    const client = new ElasticsearchClient(connection);
    return {
      execute: (request, signal) => client.query(request, signal),
    };
  },
};

datasourcePlugins.set(esqlDatasourcePlugin.kind, esqlDatasourcePlugin);

export function registerPersesDatasourcePlugin<TDatasource>(
  plugin: PersesDatasourcePlugin<TDatasource>,
): void {
  datasourcePlugins.set(plugin.kind, plugin as PersesDatasourcePlugin<unknown>);
}

export function getPersesDatasourcePlugin<TDatasource>(
  kind: string,
): PersesDatasourcePlugin<TDatasource> | undefined {
  const plugin = datasourcePlugins.get(kind);
  if (!plugin) {
    return undefined;
  }
  return plugin as PersesDatasourcePlugin<TDatasource>;
}

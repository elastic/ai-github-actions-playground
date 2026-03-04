import type { PluginModuleResource, PluginLoader } from "@perses-dev/plugin-system";
import { dynamicImportPluginLoader } from "@perses-dev/plugin-system";

import { ElasticsearchDatasource, ELASTICSEARCH_DATASOURCE_KIND } from "./elasticsearch-datasource";
import { ESQLTimeSeriesQuery, ESQL_TIME_SERIES_QUERY_KIND } from "./esql-timeseries-query";
import { ESQLExplore, ESQL_EXPLORE_KIND } from "./esql-explore";

export const PLUGIN_MODULE_NAME = "elasticsearch-esql-plugin";
export const PLUGIN_MODULE_VERSION = "0.1.0";

/**
 * Resource descriptor for this plugin module.
 * Declares the three plugins (Datasource, TimeSeriesQuery, Explore) so that
 * the Perses runtime can discover them via `getInstalledPlugins()`.
 */
export const pluginModuleResource: PluginModuleResource = {
  kind: "PluginModule",
  metadata: {
    name: PLUGIN_MODULE_NAME,
    version: PLUGIN_MODULE_VERSION,
  },
  spec: {
    plugins: [
      {
        kind: "Datasource",
        spec: {
          name: ELASTICSEARCH_DATASOURCE_KIND,
          display: {
            name: "Elasticsearch",
            description: "Elasticsearch datasource using ES|QL queries",
          },
        },
      },
      {
        kind: "TimeSeriesQuery",
        spec: {
          name: ESQL_TIME_SERIES_QUERY_KIND,
          display: {
            name: "ES|QL Time Series",
            description: "ES|QL query returning time-series data",
          },
        },
      },
      {
        kind: "Explore",
        spec: {
          name: ESQL_EXPLORE_KIND,
          display: {
            name: "ES|QL Explore",
            description: "Ad-hoc ES|QL query exploration",
          },
        },
      },
    ],
  },
};

/**
 * Maps a (pluginType, pluginKind) pair to the concrete plugin implementation.
 */
const pluginMap = new Map<string, unknown>([
  [`Datasource:${ELASTICSEARCH_DATASOURCE_KIND}`, ElasticsearchDatasource],
  [`TimeSeriesQuery:${ESQL_TIME_SERIES_QUERY_KIND}`, ESQLTimeSeriesQuery],
  [`Explore:${ESQL_EXPLORE_KIND}`, ESQLExplore],
]);

/**
 * Resolves the requested plugin kind from the static plugin map.
 * Called by the Perses runtime when it needs a specific plugin implementation.
 */
export function getPlugin(pluginType: string, kind: string): unknown {
  return pluginMap.get(`${pluginType}:${kind}`);
}

/**
 * Creates a `PluginLoader` that can be passed to Perses's `PluginRegistryContext`
 * to expose this module's plugins at runtime.
 */
export function createPluginLoader(): PluginLoader {
  return dynamicImportPluginLoader([
    {
      resource: pluginModuleResource,
      importPlugin: async () => ({
        getPlugin,
      }),
    },
  ]);
}

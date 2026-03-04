export {
  ElasticsearchDatasource,
  ELASTICSEARCH_DATASOURCE_KIND,
  type ElasticsearchDatasourceSpec,
  type ElasticsearchDatasourceClient,
} from "./elasticsearch-datasource";

export {
  ESQLTimeSeriesQuery,
  ESQL_TIME_SERIES_QUERY_KIND,
  type ESQLTimeSeriesQuerySpec,
} from "./esql-timeseries-query";

export { ESQLExplore, ESQL_EXPLORE_KIND, type ESQLExploreSpec } from "./esql-explore";

export {
  pluginModuleResource,
  getPlugin,
  createPluginLoader,
  PLUGIN_MODULE_NAME,
  PLUGIN_MODULE_VERSION,
} from "./plugin-module";

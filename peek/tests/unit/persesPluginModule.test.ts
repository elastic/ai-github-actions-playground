import { describe, expect, it, vi } from "vitest";

import {
  ElasticsearchDatasource,
  ELASTICSEARCH_DATASOURCE_KIND,
  type ElasticsearchDatasourceSpec,
} from "../../src/services/perses/plugin/elasticsearch-datasource";
import {
  ESQLTimeSeriesQuery,
  ESQL_TIME_SERIES_QUERY_KIND,
  type ESQLTimeSeriesQuerySpec,
} from "../../src/services/perses/plugin/esql-timeseries-query";
import { ESQLExplore, ESQL_EXPLORE_KIND } from "../../src/services/perses/plugin/esql-explore";
import {
  pluginModuleResource,
  getPlugin,
  createPluginLoader,
  PLUGIN_MODULE_NAME,
  PLUGIN_MODULE_VERSION,
} from "../../src/services/perses/plugin/plugin-module";

describe("Elasticsearch datasource plugin", () => {
  it("exposes the correct kind constant", () => {
    expect(ELASTICSEARCH_DATASOURCE_KIND).toBe("ElasticsearchDatasource");
  });

  it("creates initial options with a default URL", () => {
    const initial = ElasticsearchDatasource.createInitialOptions();
    expect(initial.url).toBe("https://localhost:9200");
  });

  it("creates a client with the correct kind", () => {
    const spec: ElasticsearchDatasourceSpec = {
      url: "https://test:9200",
      apiKey: "test-key",
    };
    const client = ElasticsearchDatasource.createClient(spec, {});
    expect(client.kind).toBe("ElasticsearchDatasource");
    expect(typeof client.query).toBe("function");
    expect(typeof client.healthCheck).toBe("function");
    expect(typeof client.getConnection).toBe("function");
  });

  it("returns the connection from the created client", () => {
    const spec: ElasticsearchDatasourceSpec = {
      url: "https://es.example.com:9200",
      apiKey: "my-key",
      username: "elastic",
      password: "changeme",
    };
    const client = ElasticsearchDatasource.createClient(spec, {});
    const connection = client.getConnection();
    expect(connection.url).toBe(spec.url);
    expect(connection.apiKey).toBe(spec.apiKey);
    expect(connection.username).toBe(spec.username);
    expect(connection.password).toBe(spec.password);
  });
});

describe("ESQLTimeSeriesQuery plugin", () => {
  it("exposes the correct kind constant", () => {
    expect(ESQL_TIME_SERIES_QUERY_KIND).toBe("ESQLTimeSeriesQuery");
  });

  it("creates initial options with a default query", () => {
    const initial = ESQLTimeSeriesQuery.createInitialOptions();
    expect(initial.query).toContain("FROM");
  });

  it("extracts variable dependencies from query text", () => {
    const spec: ESQLTimeSeriesQuerySpec = {
      query: "FROM {{index}} | WHERE host = '{{hostname}}' | STATS avg(cpu)",
    };
    const deps = ESQLTimeSeriesQuery.dependsOn!(spec, {
      timeRange: { start: new Date(), end: new Date() },
      variableState: {},
      datasourceStore: {} as never,
    });
    expect(deps.variables).toEqual(["index", "hostname"]);
  });

  it("returns empty dependency list for queries without variables", () => {
    const spec: ESQLTimeSeriesQuerySpec = {
      query: "FROM metrics-* | STATS avg(cpu)",
    };
    const deps = ESQLTimeSeriesQuery.dependsOn!(spec, {
      timeRange: { start: new Date(), end: new Date() },
      variableState: {},
      datasourceStore: {} as never,
    });
    expect(deps.variables).toEqual([]);
  });

  it("executes query through datasource client and transforms result", async () => {
    const mockResponse = {
      columns: [
        { name: "@timestamp", type: "date" },
        { name: "avg_cpu", type: "double" },
      ],
      values: [
        ["2024-01-01T00:00:00.000Z", 42.5],
        ["2024-01-01T00:01:00.000Z", 55.3],
      ],
      executionTimeMs: 15,
    };

    const mockClient = {
      kind: "ElasticsearchDatasource" as const,
      query: vi.fn().mockResolvedValue(mockResponse),
      healthCheck: vi.fn().mockResolvedValue(true),
      getConnection: vi.fn(),
    };

    const mockDatasourceStore = {
      getDatasourceClient: vi.fn().mockResolvedValue(mockClient),
      getDatasource: vi.fn(),
      listDatasourceSelectItems: vi.fn(),
      getLocalDatasources: vi.fn(),
      setLocalDatasources: vi.fn(),
      getSavedDatasources: vi.fn(),
      setSavedDatasources: vi.fn(),
    };

    const spec: ESQLTimeSeriesQuerySpec = {
      query: "FROM metrics-* | STATS avg(cpu) BY @timestamp",
    };

    const result = await ESQLTimeSeriesQuery.getTimeSeriesData(spec, {
      timeRange: {
        start: new Date("2024-01-01T00:00:00Z"),
        end: new Date("2024-01-01T01:00:00Z"),
      },
      variableState: {},
      datasourceStore: mockDatasourceStore,
    });

    expect(mockDatasourceStore.getDatasourceClient).toHaveBeenCalledWith({
      kind: ELASTICSEARCH_DATASOURCE_KIND,
      name: undefined,
    });
    expect(mockClient.query).toHaveBeenCalled();
    expect(result.series).toHaveLength(1);
    expect(result.series[0]?.name).toBe("avg_cpu");
    expect(result.series[0]?.values).toHaveLength(2);
  });

  it("interpolates variables in query text", async () => {
    const mockResponse = {
      columns: [{ name: "count", type: "long" }],
      values: [[100]],
      executionTimeMs: 5,
    };

    const mockClient = {
      kind: "ElasticsearchDatasource" as const,
      query: vi.fn().mockResolvedValue(mockResponse),
      healthCheck: vi.fn(),
      getConnection: vi.fn(),
    };

    const mockDatasourceStore = {
      getDatasourceClient: vi.fn().mockResolvedValue(mockClient),
      getDatasource: vi.fn(),
      listDatasourceSelectItems: vi.fn(),
      getLocalDatasources: vi.fn(),
      setLocalDatasources: vi.fn(),
      getSavedDatasources: vi.fn(),
      setSavedDatasources: vi.fn(),
    };

    const spec: ESQLTimeSeriesQuerySpec = {
      query: "FROM {{index}} | WHERE host = '{{host}}' | STATS count(*)",
    };

    await ESQLTimeSeriesQuery.getTimeSeriesData(spec, {
      timeRange: {
        start: new Date("2024-01-01T00:00:00Z"),
        end: new Date("2024-01-01T01:00:00Z"),
      },
      variableState: {
        index: { value: "logs-*", loading: false },
        host: { value: "server-1", loading: false },
      },
      datasourceStore: mockDatasourceStore,
    });

    const calledQuery = mockClient.query.mock.calls[0]?.[0]?.query;
    expect(calledQuery).toBe("FROM logs-* | WHERE host = 'server-1' | STATS count(*)");
  });

  it("passes time range filter to the ES|QL request", async () => {
    const mockResponse = {
      columns: [{ name: "count", type: "long" }],
      values: [[42]],
      executionTimeMs: 3,
    };

    const mockClient = {
      kind: "ElasticsearchDatasource" as const,
      query: vi.fn().mockResolvedValue(mockResponse),
      healthCheck: vi.fn(),
      getConnection: vi.fn(),
    };

    const mockDatasourceStore = {
      getDatasourceClient: vi.fn().mockResolvedValue(mockClient),
      getDatasource: vi.fn(),
      listDatasourceSelectItems: vi.fn(),
      getLocalDatasources: vi.fn(),
      setLocalDatasources: vi.fn(),
      getSavedDatasources: vi.fn(),
      setSavedDatasources: vi.fn(),
    };

    const start = new Date("2024-06-01T00:00:00Z");
    const end = new Date("2024-06-02T00:00:00Z");

    await ESQLTimeSeriesQuery.getTimeSeriesData(
      { query: "FROM metrics-* | STATS count(*)" },
      {
        timeRange: { start, end },
        variableState: {},
        datasourceStore: mockDatasourceStore,
      },
    );

    const calledRequest = mockClient.query.mock.calls[0]?.[0];
    expect(calledRequest?.filter).toEqual({
      range: {
        "@timestamp": {
          gte: start.toISOString(),
          lte: end.toISOString(),
        },
      },
    });
  });
});

describe("ESQLExplore plugin", () => {
  it("exposes the correct kind constant", () => {
    expect(ESQL_EXPLORE_KIND).toBe("ESQLExplore");
  });

  it("creates initial options with a default query", () => {
    const initial = ESQLExplore.createInitialOptions();
    expect(initial.query).toContain("FROM");
  });

  it("has a no-op ExploreComponent", () => {
    const result = ESQLExplore.ExploreComponent({ spec: { query: "FROM test" } });
    expect(result).toBeNull();
  });
});

describe("plugin module", () => {
  it("has correct module metadata", () => {
    expect(pluginModuleResource.kind).toBe("PluginModule");
    expect(pluginModuleResource.metadata.name).toBe(PLUGIN_MODULE_NAME);
    expect(pluginModuleResource.metadata.version).toBe(PLUGIN_MODULE_VERSION);
  });

  it("declares all three plugin kinds", () => {
    const pluginKinds = pluginModuleResource.spec.plugins.map((p) => p.kind);
    expect(pluginKinds).toContain("Datasource");
    expect(pluginKinds).toContain("TimeSeriesQuery");
    expect(pluginKinds).toContain("Explore");
  });

  it("declares correct plugin names", () => {
    const pluginNames = pluginModuleResource.spec.plugins.map((p) => p.spec.name);
    expect(pluginNames).toContain(ELASTICSEARCH_DATASOURCE_KIND);
    expect(pluginNames).toContain(ESQL_TIME_SERIES_QUERY_KIND);
    expect(pluginNames).toContain(ESQL_EXPLORE_KIND);
  });

  it("resolves Datasource plugin via getPlugin", () => {
    const plugin = getPlugin("Datasource", ELASTICSEARCH_DATASOURCE_KIND);
    expect(plugin).toBe(ElasticsearchDatasource);
  });

  it("resolves TimeSeriesQuery plugin via getPlugin", () => {
    const plugin = getPlugin("TimeSeriesQuery", ESQL_TIME_SERIES_QUERY_KIND);
    expect(plugin).toBe(ESQLTimeSeriesQuery);
  });

  it("resolves Explore plugin via getPlugin", () => {
    const plugin = getPlugin("Explore", ESQL_EXPLORE_KIND);
    expect(plugin).toBe(ESQLExplore);
  });

  it("returns undefined for unknown plugin kind", () => {
    expect(getPlugin("Datasource", "UnknownKind")).toBeUndefined();
  });

  it("creates a PluginLoader", () => {
    const loader = createPluginLoader();
    expect(typeof loader.getInstalledPlugins).toBe("function");
    expect(typeof loader.importPluginModule).toBe("function");
  });

  it("PluginLoader returns the module resource", async () => {
    const loader = createPluginLoader();
    const plugins = await loader.getInstalledPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.metadata.name).toBe(PLUGIN_MODULE_NAME);
  });
});

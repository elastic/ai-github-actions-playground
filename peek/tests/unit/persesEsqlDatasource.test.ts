// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildPersesEsqlRequest,
  createPersesEsqlDatasource,
  interpolatePersesVariableTokens,
  mapDashboardVariablesToPerses,
} from "../../src/services/perses/esqlDatasource";

describe("createPersesEsqlDatasource", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("delegates query execution to ElasticsearchClient.query", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ columns: [], values: [] }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchSpy);
    const connection = { url: "https://example.es.local:9200", apiKey: "test-key" };
    const datasource = createPersesEsqlDatasource(connection);

    const request = { query: "FROM logs-* | LIMIT 1" };
    const signal = new AbortController().signal;
    const response = await datasource.execute(request, signal);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.es.local:9200/_query?format=json",
      expect.objectContaining({ method: "POST", signal }),
    );
    expect(response.columns).toEqual([]);
    expect(response.values).toEqual([]);
    expect(typeof response.executionTimeMs).toBe("number");
  });

  it("maps dashboard parameters to perses variable definitions", () => {
    const variables = mapDashboardVariablesToPerses([
      {
        name: "service",
        label: "Service",
        type: "keyword",
        source: { mode: "text" },
        value: "api",
      },
      {
        name: "threshold",
        label: "Threshold",
        type: "number",
        source: { mode: "text" },
        value: 10,
      },
    ]);
    expect(variables).toEqual([
      { name: "service", label: "Service", kind: "string", value: "api" },
      { name: "threshold", label: "Threshold", kind: "number", value: 10 },
    ]);
  });

  it("escapes single quotes in interpolated variable values for ES|QL literals", () => {
    const variables = [
      { name: "env", label: "Environment", kind: "string" as const, value: "O'Reilly" },
    ];
    const result = interpolatePersesVariableTokens(
      "FROM logs-* | WHERE env == '{{env}}'",
      variables,
    );
    expect(result).toBe("FROM logs-* | WHERE env == 'O''Reilly'");
  });

  it("builds a perses esql request with interpolation and query params", () => {
    const request = buildPersesEsqlRequest(
      "FROM logs-* | WHERE service.name == ?service AND env == '{{env}}' | STATS c = COUNT(*) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)",
      {
        timeRange: { from: "2025-06-15T11:00:00.000Z", to: "2025-06-15T12:00:00.000Z" },
        parameters: [
          {
            name: "service",
            label: "Service",
            type: "keyword",
            source: { mode: "text" },
            value: "web",
          },
          {
            name: "env",
            label: "Environment",
            type: "keyword",
            source: { mode: "text" },
            value: "prod",
          },
        ],
      },
    );
    expect(request.query).toContain("env == 'prod'");
    expect(request.params).toEqual(
      expect.arrayContaining([
        { service: "web" },
        { _tstart: "2025-06-15T11:00:00.000Z" },
        { _tend: "2025-06-15T12:00:00.000Z" },
      ]),
    );
  });
});

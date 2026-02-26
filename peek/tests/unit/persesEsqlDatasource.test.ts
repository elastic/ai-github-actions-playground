import { afterEach, describe, expect, it, vi } from "vitest";

import { createPersesEsqlDatasource } from "../../src/services/perses/esqlDatasource";

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
});

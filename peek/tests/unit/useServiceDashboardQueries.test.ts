// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useServiceDashboardQueries } from "../../src/components/services/useServiceDashboardQueries";
import type { ElasticsearchConnection, EsqlResponse } from "../../src/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExecute = vi.fn();

vi.mock("../../src/services/perses/esqlDatasource", () => ({
  createPersesEsqlDatasource: () => ({ execute: mockExecute }),
}));

vi.mock("../../src/components/services/serviceDashboardQueryBuilder", () => ({
  buildServiceRoutesQuery: (f: { serviceName: string }) =>
    `FROM routes WHERE service = '${f.serviceName}'`,
  buildServiceRecentTracesQuery: (f: { serviceName: string }) =>
    `FROM traces WHERE service = '${f.serviceName}'`,
  buildServiceDeploymentsQuery: (f: { serviceName: string }) =>
    `FROM deployments WHERE service = '${f.serviceName}'`,
  buildServiceRouteSparklineQuery: (f: { serviceName: string }) =>
    `FROM sparkline WHERE service = '${f.serviceName}'`,
  buildServiceK8sContextQuery: (f: { serviceName: string }) =>
    `FROM k8s WHERE service = '${f.serviceName}'`,
}));

vi.mock("../../src/components/traces/traceQueryBuilder", () => ({
  buildTraceSpansForTraceIdsQuery: (ids: string[]) =>
    `FROM spans WHERE trace.id IN (${ids.map((id) => `'${id}'`).join(", ")})`,
  DEFAULT_FIELD_MAPPING: { traceId: "trace.id", spanId: "span.id" },
}));

vi.mock("../../src/components/services/serviceDashboardHelpers", () => ({
  parseRouteSparklineData: (data: EsqlResponse) => {
    if (!data || data.values.length === 0) return {};
    return { "/api/test": { points: [] } };
  },
}));

vi.mock("../../src/components/traces/traceUtils", () => ({
  parseSpansFromEsql: (_columns: unknown, values: unknown[][]) =>
    (values ?? []).map((row) => ({ traceId: row[0], spanId: row[1] })),
}));

const MOCK_CONNECTION: ElasticsearchConnection = {
  url: "http://localhost:9200",
  auth: { type: "none" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const SAMPLE_ROUTES: EsqlResponse = {
  columns: [
    { name: "route", type: "keyword" },
    { name: "count", type: "long" },
  ],
  values: [["/api/test", 42]],
};

const SAMPLE_TRACES: EsqlResponse = {
  columns: [
    { name: "trace.id", type: "keyword" },
    { name: "span.name", type: "keyword" },
  ],
  values: [
    ["trace-1", "GET /api"],
    ["trace-2", "POST /api"],
  ],
};

const SAMPLE_TRACE_SPANS: EsqlResponse = {
  columns: [
    { name: "trace.id", type: "keyword" },
    { name: "span.id", type: "keyword" },
  ],
  values: [
    ["trace-1", "span-1"],
    ["trace-2", "span-2"],
  ],
};

const SAMPLE_DEPLOYMENTS: EsqlResponse = {
  columns: [{ name: "version", type: "keyword" }],
  values: [["v1.0"]],
};

const SAMPLE_SPARKLINE: EsqlResponse = {
  columns: [{ name: "bucket", type: "date" }],
  values: [["2024-01-01"]],
};

const SAMPLE_K8S: EsqlResponse = {
  columns: [{ name: "pod.name", type: "keyword" }],
  values: [["pod-abc"]],
};

function mockAllQueries() {
  mockExecute.mockImplementation(({ query }: { query: string }) => {
    if (query.includes("FROM routes")) return Promise.resolve(SAMPLE_ROUTES);
    if (query.includes("FROM traces")) return Promise.resolve(SAMPLE_TRACES);
    if (query.includes("FROM deployments")) return Promise.resolve(SAMPLE_DEPLOYMENTS);
    if (query.includes("FROM sparkline")) return Promise.resolve(SAMPLE_SPARKLINE);
    if (query.includes("FROM k8s")) return Promise.resolve(SAMPLE_K8S);
    if (query.includes("FROM spans")) return Promise.resolve(SAMPLE_TRACE_SPANS);
    return Promise.reject(new Error(`Unexpected query: ${query}`));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useServiceDashboardQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stays idle when connection is null", () => {
    const { result } = renderHook(
      () =>
        useServiceDashboardQueries({
          connection: null,
          serviceName: "my-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.routesResult).toBeNull();
    expect(result.current.tracesResult).toBeNull();
    expect(result.current.deploymentsResult).toBeNull();
    expect(result.current.k8sContextResult).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("stays idle when serviceName is empty", () => {
    const { result } = renderHook(
      () =>
        useServiceDashboardQueries({
          connection: MOCK_CONNECTION,
          serviceName: "",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.routesResult).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("stays idle when serviceName is whitespace", () => {
    const { result } = renderHook(
      () =>
        useServiceDashboardQueries({
          connection: MOCK_CONNECTION,
          serviceName: "   ",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.routesResult).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("auto-fetches all queries when connection and serviceName are provided", async () => {
    mockAllQueries();

    const { result } = renderHook(
      () =>
        useServiceDashboardQueries({
          connection: MOCK_CONNECTION,
          serviceName: "my-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.routesResult).toEqual(SAMPLE_ROUTES);
    expect(result.current.tracesResult).toEqual(SAMPLE_TRACES);
    expect(result.current.deploymentsResult).toEqual(SAMPLE_DEPLOYMENTS);
    expect(result.current.k8sContextResult).toEqual(SAMPLE_K8S);
    expect(result.current.error).toBeNull();
    // 5 primary queries + 1 dependent trace-spans query
    expect(mockExecute).toHaveBeenCalledTimes(6);
  });

  it("fetches trace spans as a dependent query after traces return", async () => {
    mockAllQueries();

    const { result } = renderHook(
      () =>
        useServiceDashboardQueries({
          connection: MOCK_CONNECTION,
          serviceName: "my-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.traceExplorerSpans.length).toBeGreaterThan(0);
    });

    expect(result.current.traceExplorerSpans).toEqual([
      { traceId: "trace-1", spanId: "span-1" },
      { traceId: "trace-2", spanId: "span-2" },
    ]);
    expect(result.current.traceExplorerLoading).toBe(false);
  });

  it("does not fetch trace spans when traces return no trace IDs", async () => {
    const emptyTraces: EsqlResponse = {
      columns: [
        { name: "trace.id", type: "keyword" },
        { name: "span.name", type: "keyword" },
      ],
      values: [],
    };

    mockExecute.mockImplementation(({ query }: { query: string }) => {
      if (query.includes("FROM routes")) return Promise.resolve(SAMPLE_ROUTES);
      if (query.includes("FROM traces")) return Promise.resolve(emptyTraces);
      if (query.includes("FROM deployments")) return Promise.resolve(SAMPLE_DEPLOYMENTS);
      if (query.includes("FROM sparkline")) return Promise.resolve(SAMPLE_SPARKLINE);
      if (query.includes("FROM k8s")) return Promise.resolve(SAMPLE_K8S);
      return Promise.reject(new Error(`Unexpected query: ${query}`));
    });

    const { result } = renderHook(
      () =>
        useServiceDashboardQueries({
          connection: MOCK_CONNECTION,
          serviceName: "my-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.traceExplorerSpans).toEqual([]);
    // Only 5 primary queries, no trace-spans query
    expect(mockExecute).toHaveBeenCalledTimes(5);
  });

  it("aggregates loading state from all queries", async () => {
    let resolveQuery!: (value: EsqlResponse) => void;
    mockExecute.mockImplementation(
      () => new Promise<EsqlResponse>((resolve) => (resolveQuery = resolve)),
    );

    const { result } = renderHook(
      () =>
        useServiceDashboardQueries({
          connection: MOCK_CONNECTION,
          serviceName: "my-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    await act(async () => {
      resolveQuery(SAMPLE_ROUTES);
    });
  });

  it("aggregates first error from any failing query", async () => {
    mockExecute.mockRejectedValue(new Error("connection timeout"));

    const { result } = renderHook(
      () =>
        useServiceDashboardQueries({
          connection: MOCK_CONNECTION,
          serviceName: "my-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("connection timeout");
    });
  });

  it("handleReset clears all results and disables queries", async () => {
    mockAllQueries();

    const { result } = renderHook(
      () =>
        useServiceDashboardQueries({
          connection: MOCK_CONNECTION,
          serviceName: "my-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.routesResult).toEqual(SAMPLE_ROUTES);
    });

    act(() => {
      result.current.handleReset();
    });

    await waitFor(() => {
      expect(result.current.routesResult).toBeNull();
      expect(result.current.tracesResult).toBeNull();
      expect(result.current.deploymentsResult).toBeNull();
      expect(result.current.k8sContextResult).toBeNull();
      expect(result.current.traceExplorerSpans).toEqual([]);
      expect(result.current.routeSparklineData).toEqual({});
      expect(result.current.loading).toBe(false);
    });
  });

  it("handleReset is a no-op while loading", async () => {
    mockExecute.mockImplementation(
      () => new Promise<EsqlResponse>(() => {}), // never resolves
    );

    const { result } = renderHook(
      () =>
        useServiceDashboardQueries({
          connection: MOCK_CONNECTION,
          serviceName: "my-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    const callsBefore = mockExecute.mock.calls.length;
    act(() => {
      result.current.handleReset();
    });

    // Still loading — reset was ignored
    expect(result.current.loading).toBe(true);
    expect(mockExecute.mock.calls.length).toBe(callsBefore);
  });

  it("re-enables queries when search params change after reset", async () => {
    mockAllQueries();

    const wrapper = createWrapper();
    const { result, rerender } = renderHook(
      (props: {
        connection: ElasticsearchConnection | null;
        serviceName: string;
        timeFrom: string;
        timeTo: string;
      }) => useServiceDashboardQueries(props),
      {
        wrapper,
        initialProps: {
          connection: MOCK_CONNECTION,
          serviceName: "my-service",
          timeFrom: "now-1h",
          timeTo: "now",
        },
      },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.routesResult).toEqual(SAMPLE_ROUTES);
    });

    act(() => {
      result.current.handleReset();
    });

    await waitFor(() => {
      expect(result.current.routesResult).toBeNull();
    });

    // Change time range — should re-enable queries
    mockExecute.mockClear();
    mockAllQueries();
    rerender({
      connection: MOCK_CONNECTION,
      serviceName: "my-service",
      timeFrom: "now-2h",
      timeTo: "now",
    });

    await waitFor(() => {
      expect(result.current.routesResult).toEqual(SAMPLE_ROUTES);
    });

    expect(mockExecute).toHaveBeenCalled();
  });

  it("clearLatestQueries is a no-op", () => {
    const { result } = renderHook(
      () =>
        useServiceDashboardQueries({
          connection: MOCK_CONNECTION,
          serviceName: "my-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    // Should not throw
    act(() => {
      result.current.clearLatestQueries();
    });
  });

  it("parses sparkline data from sparkline query result", async () => {
    mockAllQueries();

    const { result } = renderHook(
      () =>
        useServiceDashboardQueries({
          connection: MOCK_CONNECTION,
          serviceName: "my-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.routeSparklineData).toEqual({ "/api/test": { points: [] } });
  });

  it("returns empty sparkline data when no sparkline result", () => {
    const { result } = renderHook(
      () =>
        useServiceDashboardQueries({
          connection: null,
          serviceName: "my-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.routeSparklineData).toEqual({});
  });
});

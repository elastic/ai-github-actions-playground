// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useSimpleEsqlQuery } from "../../src/hooks/useSimpleEsqlQuery";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import type { ElasticsearchConnection, EsqlResponse } from "../../src/types";
import { resetAllStores } from "../fixtures/test-utils";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExecute = vi.fn();

vi.mock("../../src/services/perses/esqlDatasource", () => ({
  createPersesEsqlDatasource: () => ({ execute: mockExecute }),
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

const SAMPLE_RESPONSE: EsqlResponse = {
  columns: [{ name: "count", type: "long" }],
  values: [[42]],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSimpleEsqlQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
  });

  it("stays idle when query is null", () => {
    useConnectionStore.setState({ connection: MOCK_CONNECTION });
    const { result } = renderHook(() => useSimpleEsqlQuery({ query: null }), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("does not refetch on same-url connection change when query is null", async () => {
    useConnectionStore.setState({ connection: MOCK_CONNECTION });
    const { result } = renderHook(() => useSimpleEsqlQuery({ query: null }), {
      wrapper: createWrapper(),
    });

    act(() => {
      useConnectionStore.setState({ connection: { ...MOCK_CONNECTION } });
    });
    await Promise.resolve();

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("stays idle when connection is null", () => {
    const { result } = renderHook(() => useSimpleEsqlQuery({ query: "FROM index | LIMIT 10" }), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("stays idle when enabled is false", () => {
    useConnectionStore.setState({ connection: MOCK_CONNECTION });
    const { result } = renderHook(
      () => useSimpleEsqlQuery({ query: "FROM index | LIMIT 10", enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("does not evaluate buildRequest when enabled is false", () => {
    useConnectionStore.setState({ connection: MOCK_CONNECTION });
    const buildRequest = vi.fn(() => ({ query: "FROM index" }));
    const { result } = renderHook(
      () => useSimpleEsqlQuery({ query: "FROM index", enabled: false, buildRequest }),
      { wrapper: createWrapper() },
    );

    expect(buildRequest).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("does not evaluate buildRequest when connection is null", () => {
    const buildRequest = vi.fn(() => ({ query: "FROM index" }));
    const { result } = renderHook(() => useSimpleEsqlQuery({ query: "FROM index", buildRequest }), {
      wrapper: createWrapper(),
    });

    expect(buildRequest).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("does not refetch on same-url connection change when query is whitespace", async () => {
    useConnectionStore.setState({ connection: MOCK_CONNECTION });
    const { result } = renderHook(() => useSimpleEsqlQuery({ query: "   " }), {
      wrapper: createWrapper(),
    });

    act(() => {
      useConnectionStore.setState({ connection: { ...MOCK_CONNECTION } });
    });
    await Promise.resolve();

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("does not refetch on same-url connection change when enabled is false", async () => {
    useConnectionStore.setState({ connection: MOCK_CONNECTION });
    const { result } = renderHook(
      () => useSimpleEsqlQuery({ query: "FROM index | LIMIT 10", enabled: false }),
      { wrapper: createWrapper() },
    );

    act(() => {
      useConnectionStore.setState({ connection: { ...MOCK_CONNECTION } });
    });
    await Promise.resolve();

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("executes query and returns data on success", async () => {
    useConnectionStore.setState({ connection: MOCK_CONNECTION });
    mockExecute.mockResolvedValueOnce(SAMPLE_RESPONSE);

    const { result } = renderHook(() => useSimpleEsqlQuery({ query: "FROM index | LIMIT 10" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(SAMPLE_RESPONSE);
    });

    expect(result.current.error).toBeNull();
    expect(mockExecute).toHaveBeenCalledWith(
      { query: "FROM index | LIMIT 10" },
      expect.any(AbortSignal),
    );
  });

  it("returns error message on failure", async () => {
    useConnectionStore.setState({ connection: MOCK_CONNECTION });
    mockExecute.mockRejectedValueOnce(new Error("query failed"));

    const { result } = renderHook(() => useSimpleEsqlQuery({ query: "FROM bad_index" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("query failed");
    });

    expect(result.current.data).toBeNull();
  });

  it("uses buildRequest when provided", async () => {
    useConnectionStore.setState({ connection: MOCK_CONNECTION });
    mockExecute.mockResolvedValueOnce(SAMPLE_RESPONSE);

    const buildRequest = (q: string) => ({
      query: q,
      filter: { range: { "@timestamp": { gte: "now-1h", lte: "now" } } },
    });

    const { result } = renderHook(
      () => useSimpleEsqlQuery({ query: "FROM index | LIMIT 10", buildRequest }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(SAMPLE_RESPONSE);
    });

    expect(mockExecute).toHaveBeenCalledWith(
      {
        query: "FROM index | LIMIT 10",
        filter: { range: { "@timestamp": { gte: "now-1h", lte: "now" } } },
      },
      expect.any(AbortSignal),
    );
  });

  it("trims whitespace from query", async () => {
    useConnectionStore.setState({ connection: MOCK_CONNECTION });
    mockExecute.mockResolvedValueOnce(SAMPLE_RESPONSE);

    const { result } = renderHook(
      () => useSimpleEsqlQuery({ query: "  FROM index | LIMIT 10  " }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(SAMPLE_RESPONSE);
    });

    expect(mockExecute).toHaveBeenCalledWith(
      { query: "FROM index | LIMIT 10" },
      expect.any(AbortSignal),
    );
  });

  it("returns buildRequest errors without executing", () => {
    useConnectionStore.setState({ connection: MOCK_CONNECTION });
    const { result } = renderHook(
      () =>
        useSimpleEsqlQuery({
          query: "FROM index | LIMIT 10",
          buildRequest: () => {
            throw new Error("invalid request");
          },
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("invalid request");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("does not execute when query is only whitespace", () => {
    useConnectionStore.setState({ connection: MOCK_CONNECTION });
    const { result } = renderHook(() => useSimpleEsqlQuery({ query: "   " }), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

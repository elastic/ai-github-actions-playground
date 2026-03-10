// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useInstrumentationScore } from "../../src/hooks/useInstrumentationScore";
import type { ElasticsearchConnection, EsqlResponse } from "../../src/types";

const instrumentationScoreState = vi.hoisted(() => ({
  rules: [{ id: "RES-005" }, { id: "SPA-001" }],
  mockExecute: vi.fn(),
  mockEvaluateInstrumentationScore: vi.fn(),
  mockParseInstrumentationScoreResult: vi.fn(),
}));

vi.mock("../../src/services/perses/esqlDatasource", () => ({
  createPersesEsqlDatasource: () => ({ execute: instrumentationScoreState.mockExecute }),
}));

vi.mock("../../src/instrumentation-score", () => ({
  INSTRUMENTATION_SCORE_RULES: instrumentationScoreState.rules,
  buildInstrumentationScoreQuery: () => "MAIN_QUERY",
  buildInternalSpanCountQuery: () => "INTERNAL_QUERY",
  buildSpanNameCardinalityQuery: () => "CARDINALITY_QUERY",
  buildDuplicateInstanceIdQuery: () => "DUPLICATE_QUERY",
  evaluateInstrumentationScore: instrumentationScoreState.mockEvaluateInstrumentationScore,
}));

vi.mock("../../src/instrumentation-score/snapshotParser", () => ({
  parseInstrumentationScoreResult: instrumentationScoreState.mockParseInstrumentationScoreResult,
}));

const MOCK_CONNECTION: ElasticsearchConnection = {
  url: "http://localhost:9200",
  apiKey: "test-api-key",
};

const MAIN_RESULT: EsqlResponse = {
  columns: [{ name: "total_spans", type: "long" }],
  values: [[10]],
};

const INTERNAL_RESULT: EsqlResponse = {
  columns: [{ name: "max_internal_per_trace", type: "long" }],
  values: [[3]],
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useInstrumentationScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    instrumentationScoreState.rules.splice(
      0,
      instrumentationScoreState.rules.length,
      { id: "RES-005" },
      { id: "SPA-001" },
    );
    instrumentationScoreState.mockParseInstrumentationScoreResult.mockReturnValue({
      totalSpanCount: 10,
      duplicateInstanceIdCount: 0,
      internalSpanMetricsAvailable: true,
      distinctSpanNameCount: 5,
      spanNameCardinalityMetricsAvailable: true,
      duplicateInstanceMetricsAvailable: true,
    });
    instrumentationScoreState.mockEvaluateInstrumentationScore.mockReturnValue({
      score: 100,
      category: "excellent",
      passed: 2,
      total: 2,
      rules: [],
    });
  });

  it("does not execute duplicate query when no active rule needs it", async () => {
    instrumentationScoreState.mockExecute.mockImplementation(({ query }: { query: string }) => {
      if (query === "MAIN_QUERY") return Promise.resolve(MAIN_RESULT);
      if (query === "INTERNAL_QUERY") return Promise.resolve(INTERNAL_RESULT);
      if (query === "DUPLICATE_QUERY") return Promise.resolve({ columns: [], values: [[1]] });
      return Promise.reject(new Error(`Unexpected query: ${query}`));
    });

    const { result } = renderHook(
      () =>
        useInstrumentationScore({
          connection: MOCK_CONNECTION,
          serviceName: "checkout-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.score?.score).toBe(100);
    });

    expect(instrumentationScoreState.mockExecute).toHaveBeenCalledTimes(2);
    expect(instrumentationScoreState.mockExecute).toHaveBeenCalledWith(
      { query: "MAIN_QUERY" },
      expect.any(AbortSignal),
    );
    expect(instrumentationScoreState.mockExecute).toHaveBeenCalledWith(
      { query: "INTERNAL_QUERY" },
      expect.any(AbortSignal),
    );
    expect(instrumentationScoreState.mockExecute).not.toHaveBeenCalledWith(
      { query: "DUPLICATE_QUERY" },
      expect.any(AbortSignal),
    );
    expect(instrumentationScoreState.mockExecute).not.toHaveBeenCalledWith(
      { query: "CARDINALITY_QUERY" },
      expect.any(AbortSignal),
    );
    expect(instrumentationScoreState.mockParseInstrumentationScoreResult).toHaveBeenCalledWith(
      "checkout-service",
      MAIN_RESULT,
      INTERNAL_RESULT,
      null,
      null,
    );
  });

  it("formats object errors using the message property", async () => {
    instrumentationScoreState.mockExecute.mockRejectedValueOnce({ message: "index not found" });

    const { result } = renderHook(
      () =>
        useInstrumentationScore({
          connection: MOCK_CONNECTION,
          serviceName: "checkout-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("index not found");
    });
    expect(result.current.error).not.toBe("[object Object]");
  });

  it("keeps score visible when a secondary query fails", async () => {
    instrumentationScoreState.mockExecute.mockImplementation(({ query }: { query: string }) => {
      if (query === "MAIN_QUERY") return Promise.resolve(MAIN_RESULT);
      if (query === "INTERNAL_QUERY") return Promise.reject(new Error("internal query failed"));
      return Promise.reject(new Error(`Unexpected query: ${query}`));
    });
    instrumentationScoreState.mockParseInstrumentationScoreResult.mockReturnValue({
      totalSpanCount: 10,
      duplicateInstanceIdCount: 0,
      internalSpanMetricsAvailable: false,
      distinctSpanNameCount: 0,
      spanNameCardinalityMetricsAvailable: false,
      duplicateInstanceMetricsAvailable: true,
    });

    const { result } = renderHook(
      () =>
        useInstrumentationScore({
          connection: MOCK_CONNECTION,
          serviceName: "checkout-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.score?.score).toBe(100);
      expect(result.current.error).toBe("internal query failed");
    });

    expect(instrumentationScoreState.mockParseInstrumentationScoreResult).toHaveBeenCalledWith(
      "checkout-service",
      MAIN_RESULT,
      null,
      null,
      null,
    );
  });

  it("executes span-name cardinality query when SPA-003 is active", async () => {
    instrumentationScoreState.rules.splice(0, instrumentationScoreState.rules.length, {
      id: "SPA-003",
    });
    instrumentationScoreState.mockExecute.mockImplementation(({ query }: { query: string }) => {
      if (query === "MAIN_QUERY") return Promise.resolve(MAIN_RESULT);
      if (query === "CARDINALITY_QUERY") {
        return Promise.resolve({
          columns: [{ name: "distinct_span_names", type: "long" }],
          values: [[12]],
        });
      }
      return Promise.reject(new Error(`Unexpected query: ${query}`));
    });

    const { result } = renderHook(
      () =>
        useInstrumentationScore({
          connection: MOCK_CONNECTION,
          serviceName: "checkout-service",
          timeFrom: "now-1h",
          timeTo: "now",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.score?.score).toBe(100);
    });

    expect(instrumentationScoreState.mockExecute).toHaveBeenCalledWith(
      { query: "CARDINALITY_QUERY" },
      expect.any(AbortSignal),
    );
  });

  it("does not execute queries when disabled", async () => {
    const { result } = renderHook(
      () =>
        useInstrumentationScore({
          connection: MOCK_CONNECTION,
          serviceName: "checkout-service",
          timeFrom: "now-1h",
          timeTo: "now",
          enabled: false,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.score).toBeNull();
    expect(result.current.error).toBeNull();
    expect(instrumentationScoreState.mockExecute).not.toHaveBeenCalled();
  });
});

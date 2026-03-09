// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useExploreQuery } from "../../src/hooks/useExploreQuery";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import type { ElasticsearchConnection } from "../../src/types";
import { resetAllStores } from "../fixtures/test-utils";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const queryMock = vi.fn().mockResolvedValue({
  columns: [{ name: "value", type: "double" }],
  values: [[1]],
  executionTimeMs: 1,
});

vi.mock("../../src/services/es/client", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    ElasticsearchClient: vi.fn().mockImplementation(() => ({
      query: queryMock,
    })),
  };
});

const MOCK_CONNECTION: ElasticsearchConnection = {
  url: "http://localhost:9200",
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

const BASE_PROPS = {
  indexPattern: "metrics-*",
  selectedMetric: "system.cpu.total.pct",
  metricType: "gauge" as const,
  aggregation: "avg" as const,
  filters: [] as never[],
  groupBy: null,
  timeRange: { from: "now-1h", to: "now" },
  enabled: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useExploreQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore.setState({ connection: MOCK_CONNECTION });
  });

  it("should not fire extra network calls when queryOverride stays the same (committed override pattern)", async () => {
    // When ExplorePage passes the *committed* override (not the live editor
    // text), the query key doesn't change on keystrokes. This test verifies
    // that keeping queryOverride unchanged between rerenders does not trigger
    // an additional fetch — matching the fix where ExplorePage only updates
    // queryOverride on explicit Search.
    const { rerender } = renderHook(
      (props: typeof BASE_PROPS & { queryOverride: string | null }) => useExploreQuery(props),
      {
        wrapper: createWrapper(),
        initialProps: { ...BASE_PROPS, queryOverride: "FROM metrics-* | LIMIT 10" },
      },
    );

    // Wait for the initial query to fire
    await waitFor(() => {
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    // Re-render without changing queryOverride (simulates the user editing
    // the CodeMirror editor while ExplorePage holds the committed value)
    rerender({ ...BASE_PROPS, queryOverride: "FROM metrics-* | LIMIT 10" });

    // Flush pending microtasks and give React Query a chance to schedule
    await act(() => new Promise((r) => setTimeout(r, 0)));

    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("fires a new request when queryOverride is explicitly updated (Search clicked)", async () => {
    const { rerender } = renderHook(
      (props: typeof BASE_PROPS & { queryOverride: string | null }) => useExploreQuery(props),
      {
        wrapper: createWrapper(),
        initialProps: { ...BASE_PROPS, queryOverride: "FROM metrics-* | LIMIT 10" },
      },
    );

    await waitFor(() => {
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    // Simulate the committed override changing (user clicked Search)
    rerender({ ...BASE_PROPS, queryOverride: "FROM metrics-* | LIMIT 100" });

    await waitFor(() => {
      expect(queryMock).toHaveBeenCalledTimes(2);
    });
  });
});

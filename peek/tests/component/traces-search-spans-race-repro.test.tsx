import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import TracesPage from "../../src/components/traces/TracesPage";
import { useTracesStore } from "../../src/store/useTracesStore";
import { EMPTY_FILTERS } from "../../src/components/traces/traceQueryBuilder";
import type { EsqlResponse } from "../../src/types";

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value }: { value: string }) => <div data-testid="codemirror-mock">{value}</div>,
}));
vi.mock("@codemirror/lang-sql", () => ({
  sql: () => [],
  SQLDialect: { define: () => ({ language: [] }) },
}));
vi.mock("../../src/components/llmCompletionExtension", () => ({
  makeLLMCompletionExtension: () => [],
}));
vi.mock("../../src/components/visualizations/WaterfallChart", () => ({ default: () => null }));
vi.mock("@perses-dev/tracing-gantt-chart-plugin/lib/TracingGanttChart/TracingGanttChart", () => ({
  TracingGanttChart: () => null,
}));
vi.mock("../../src/components/visualizations/TraceScatterChart", () => ({ default: () => null }));
vi.mock("../../src/components/visualizations/TraceServiceMap", () => ({ default: () => null }));
vi.mock("../../src/components/visualizations/DriftRadarMap", () => ({ default: () => null }));
vi.mock("../../src/components/visualizations/TimeSeriesChart", () => ({ default: () => null }));
vi.mock("../../src/components/traces/SpanDetailDrawer", () => ({ default: () => null }));
vi.mock("react-virtuoso", () => ({
  Virtuoso: ({
    data,
    itemContent,
  }: {
    data: unknown[];
    itemContent: (index: number, item: unknown) => React.ReactNode;
  }) => (
    <div data-testid="virtuoso-mock">
      {data?.map((item, i) => (
        <div key={i}>{itemContent(i, item)}</div>
      ))}
    </div>
  ),
}));

// Mock useEsqlQuery so that abort() prevents future onSuccess invocations,
// mirroring the real requestIdRef guard inside the hook.
// Hook order in useTracesOrchestrator:
// 0 = search spans query, 1 = main search query, 2 = trace detail, ...
let guardedCallbacks: Array<((data: EsqlResponse, query: string) => void) | undefined> = [];
const runQueryMock = vi.fn();
let hookCallCount = 0;
const abortedFlags: boolean[] = [];
vi.mock("../../src/hooks/useEsqlQuery", () => ({
  useEsqlQuery: (opts: { onSuccess?: (data: EsqlResponse, query: string) => void }) => {
    const idx = hookCallCount;
    hookCallCount += 1;
    abortedFlags[idx] = false;
    const rawCb = opts.onSuccess;
    guardedCallbacks.push(
      rawCb
        ? (data: EsqlResponse, query: string) => {
            if (!abortedFlags[idx]) rawCb(data, query);
          }
        : undefined,
    );
    return {
      runQuery: runQueryMock,
      loading: false,
      error: null,
      abort: () => {
        abortedFlags[idx] = true;
      },
    };
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <TracesPage />
        </NuqsTestingAdapter>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("traces stale spans race reproduction", () => {
  beforeEach(() => {
    guardedCallbacks = [];
    hookCallCount = 0;
    abortedFlags.fill(false);
    runQueryMock.mockClear();
    useTracesStore.setState({
      filters: { ...EMPTY_FILTERS },
      rawQuery: null,
      selectedTraceId: null,
      selectedTraceSpans: [],
      selectedSpanId: null,
      viewMode: "list",
      drawerOpen: false,
      pendingSearch: false,
      searchResult: null,
      searchSpans: [],
      timeseriesResult: null,
    });
  });

  it("does not allow stale spans from an older search to overwrite a newer empty result", () => {
    renderPage();
    expect(hookCallCount).toBeGreaterThanOrEqual(2);

    // Search A returns one trace id => orchestrator requests spans for A.
    act(() => {
      guardedCallbacks[1]?.(
        {
          columns: [{ name: "trace.id", type: "keyword" }],
          values: [["trace-a"]],
        },
        "FROM traces-*",
      );
    });
    expect(runQueryMock).toHaveBeenCalled();

    // Search B runs next and returns no trace ids => UI is cleared,
    // and the in-flight spans query from Search A is aborted.
    act(() => {
      guardedCallbacks[1]?.(
        {
          columns: [{ name: "trace.id", type: "keyword" }],
          values: [],
        },
        "FROM traces-*",
      );
    });
    expect(useTracesStore.getState().searchSpans).toEqual([]);

    // Older async spans response from Search A arrives late.
    // Because the orchestrator called abort() on the spans hook,
    // this callback should be a no-op.
    act(() => {
      guardedCallbacks[0]?.(
        {
          columns: [
            { name: "trace.id", type: "keyword" },
            { name: "span.id", type: "keyword" },
            { name: "parent.id", type: "keyword" },
            { name: "service.name", type: "keyword" },
            { name: "name", type: "keyword" },
            { name: "duration.us", type: "long" },
            { name: "status.code", type: "keyword" },
            { name: "@timestamp", type: "date" },
          ],
          values: [
            [
              "trace-a",
              "span-a",
              null,
              "checkout",
              "GET /checkout",
              1000,
              "STATUS_CODE_OK",
              "2026-03-01T00:00:00.000Z",
            ],
          ],
        },
        "FROM traces-*",
      );
    });

    // searchSpans must remain empty — the abort prevented stale data from landing.
    expect(useTracesStore.getState().searchSpans).toEqual([]);
  });
});

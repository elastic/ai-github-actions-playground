import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

// Collect onSuccess callbacks from each useEsqlQuery call.
// Current order in useTracesOrchestrator:
// 0 = search spans query, 1 = main search query, 2 = trace detail, ...
let capturedCallbacks: Array<((data: EsqlResponse, query: string) => void) | undefined> = [];
const mockRunQuery = vi.fn();
let mockErrorsByHook: Array<string | null> = [];
let esqlHookCallCount = 0;
vi.mock("../../src/hooks/useEsqlQuery", () => ({
  useEsqlQuery: (opts: { onSuccess?: (data: EsqlResponse, query: string) => void }) => {
    const hookIndex = esqlHookCallCount;
    esqlHookCallCount += 1;
    capturedCallbacks.push(opts.onSuccess);
    return { runQuery: mockRunQuery, loading: false, error: mockErrorsByHook[hookIndex] ?? null };
  },
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

beforeEach(() => {
  esqlHookCallCount = 0;
  mockErrorsByHook = [];
});

let queryClient: QueryClient;

function createQueryClient() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderTracesPage() {
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

function isDriftRadarQuery(query: string): boolean {
  return (
    query.includes("FROM traces-*") &&
    !query.includes("parent.id IS NULL") &&
    !query.includes("STATS request_count")
  );
}

describe("TracesPage duration filter", () => {
  beforeEach(() => {
    mockRunQuery.mockClear();
    createQueryClient();
    useTracesStore.setState({
      filters: { ...EMPTY_FILTERS },
      rawQuery: null,
      selectedTraceId: null,
      selectedTraceSpans: [],
      selectedSpanId: null,
      viewMode: "list",
      drawerOpen: false,
    });
  });

  it("applies a minimum duration of 0ms", async () => {
    const user = userEvent.setup();
    renderTracesPage();

    await user.type(screen.getByPlaceholderText("Min (ms)"), "0");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(useTracesStore.getState().filters.minDurationMs).toBe(0);
  });

  it("applies a non-zero minimum duration", async () => {
    const user = userEvent.setup();
    renderTracesPage();

    await user.type(screen.getByPlaceholderText("Min (ms)"), "100");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(useTracesStore.getState().filters.minDurationMs).toBe(100);
  });

  it("clears minDurationMs when input is empty", async () => {
    const user = userEvent.setup();
    renderTracesPage();

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(useTracesStore.getState().filters.minDurationMs).toBeNull();
  });

  it("clears duration input fields on Reset Filters", async () => {
    const user = userEvent.setup();
    renderTracesPage();

    const minInput = screen.getByPlaceholderText("Min (ms)");
    const maxInput = screen.getByPlaceholderText("Max (ms)");

    await user.type(minInput, "123");
    await user.type(maxInput, "456");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(useTracesStore.getState().filters.minDurationMs).toBe(123);
    expect(useTracesStore.getState().filters.maxDurationMs).toBe(456);

    await user.click(screen.getByRole("button", { name: "Reset Filters" }));

    expect(useTracesStore.getState().filters.minDurationMs).toBeNull();
    expect(useTracesStore.getState().filters.maxDurationMs).toBeNull();
    expect(minInput).toHaveValue("");
    expect(maxInput).toHaveValue("");
  });
});

describe("TracesPage empty states", () => {
  beforeEach(() => {
    capturedCallbacks = [];
    mockRunQuery.mockClear();
    createQueryClient();
    useTracesStore.setState({
      filters: { ...EMPTY_FILTERS },
      rawQuery: null,
      selectedTraceId: null,
      selectedTraceSpans: [],
      selectedSpanId: null,
      viewMode: "list",
      drawerOpen: false,
    });
  });

  it("shows only the Drift Radar message (not the generic one) when viewMode is driftRadar and no result exists", () => {
    useTracesStore.setState({ viewMode: "driftRadar" });
    renderTracesPage();

    expect(
      screen.getByText("Search for traces to load the Drift Radar service map."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Search for traces")).not.toBeInTheDocument();
  });

  it("shows no-results guidance in list view when a search returns zero traces", async () => {
    renderTracesPage();

    act(() => {
      capturedCallbacks[1]?.({ columns: [], values: [] }, "FROM traces");
    });

    await waitFor(() => {
      expect(screen.getByText("No traces matched the current filters.")).toBeInTheDocument();
    });
    expect(screen.getByText("Adjust filters or widen the time range.")).toBeInTheDocument();
  });
});

describe("TracesPage auto-run on quick filter changes", () => {
  beforeEach(() => {
    capturedCallbacks = [];
    mockRunQuery.mockClear();
    createQueryClient();
    useTracesStore.setState({
      filters: { ...EMPTY_FILTERS },
      rawQuery: null,
      selectedTraceId: null,
      selectedTraceSpans: [],
      selectedSpanId: null,
      viewMode: "list",
      drawerOpen: false,
    });
  });

  it("auto-runs query when duration Apply is clicked", async () => {
    const user = userEvent.setup();
    renderTracesPage();

    mockRunQuery.mockClear();
    await user.type(screen.getByPlaceholderText("Min (ms)"), "50");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(mockRunQuery).toHaveBeenCalled();
  });

  it("uses duration-us fallback expression when applying duration filters", async () => {
    const user = userEvent.setup();
    renderTracesPage();

    mockRunQuery.mockClear();
    await user.type(screen.getByPlaceholderText("Min (ms)"), "2");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    const traceQuery =
      mockRunQuery.mock.calls
        .map(([query]) => String(query ?? ""))
        .find((query) =>
          query.includes("COALESCE(attributes.span.duration.us, duration / 1000)"),
        ) ?? "";
    expect(traceQuery).toContain("COALESCE(attributes.span.duration.us, duration / 1000)");
    expect(traceQuery).toContain(">= 2000");
  });

  it("auto-runs query when a status chip is toggled", async () => {
    const user = userEvent.setup();
    renderTracesPage();

    mockRunQuery.mockClear();
    await user.click(screen.getByText("Error"));

    expect(mockRunQuery).toHaveBeenCalled();
    expect(useTracesStore.getState().filters.statusCodes).toContain("Error");
  });

  it("auto-runs query when a service is added", async () => {
    const user = userEvent.setup();
    renderTracesPage();

    mockRunQuery.mockClear();
    await user.type(screen.getByPlaceholderText("Service name"), "my-service{enter}");

    await waitFor(() => expect(mockRunQuery).toHaveBeenCalled());
    expect(useTracesStore.getState().filters.services).toContain("my-service");
  });

  it("auto-runs query when a status chip pill is deleted", async () => {
    useTracesStore.setState({
      filters: { ...EMPTY_FILTERS, statusCodes: ["Error"] },
    });

    const user = userEvent.setup();
    renderTracesPage();

    mockRunQuery.mockClear();
    const deleteButton = screen.getByTestId("trace-status-chip-delete-error");
    await user.click(deleteButton);

    expect(mockRunQuery).toHaveBeenCalled();
    expect(useTracesStore.getState().filters.statusCodes).not.toContain("Error");
  });

  it("refreshes Drift Radar spans when quick filters change in Drift Radar mode", async () => {
    useTracesStore.setState({ viewMode: "driftRadar" });
    const user = userEvent.setup();
    renderTracesPage();

    mockRunQuery.mockClear();
    await user.click(screen.getByText("Error"));

    const queries = mockRunQuery.mock.calls.map(([query]) => String(query));
    expect(queries.some(isDriftRadarQuery)).toBe(true);
  });
});

describe("TracesPage duration parsing", () => {
  beforeEach(() => {
    capturedCallbacks = [];
    mockRunQuery.mockClear();
    createQueryClient();
    useTracesStore.setState({
      filters: { ...EMPTY_FILTERS },
      rawQuery: null,
      selectedTraceId: null,
      selectedTraceSpans: [],
      selectedSpanId: null,
      viewMode: "list",
      drawerOpen: false,
    });
  });

  it("falls back to nanosecond duration when microsecond field is missing", async () => {
    renderTracesPage();

    act(() => {
      capturedCallbacks[1]?.(
        {
          columns: [
            { name: "trace.id", type: "keyword" },
            { name: "span.id", type: "keyword" },
            { name: "service.name", type: "keyword" },
            { name: "name", type: "keyword" },
            { name: "duration", type: "long" },
            { name: "status.code", type: "keyword" },
            { name: "@timestamp", type: "date" },
          ],
          values: [
            [
              "trace-1",
              "span-1",
              "checkout",
              "GET /checkout",
              2_000_000,
              "STATUS_CODE_OK",
              "2026-02-23T10:00:00.000Z",
            ],
          ],
        },
        "FROM traces-*",
      );
      capturedCallbacks[0]?.(
        {
          columns: [
            { name: "trace.id", type: "keyword" },
            { name: "span.id", type: "keyword" },
            { name: "parent.id", type: "keyword" },
            { name: "service.name", type: "keyword" },
            { name: "name", type: "keyword" },
            { name: "duration", type: "long" },
            { name: "status.code", type: "keyword" },
            { name: "@timestamp", type: "date" },
          ],
          values: [
            [
              "trace-1",
              "span-1",
              null,
              "checkout",
              "GET /checkout",
              2_000_000,
              "STATUS_CODE_OK",
              "2026-02-23T10:00:00.000Z",
            ],
          ],
        },
        "FROM traces-*",
      );
    });

    await waitFor(() => {
      expect(screen.getByText("2.0ms")).toBeInTheDocument();
    });
  });
});

describe("TracesPage error alerts", () => {
  beforeEach(() => {
    capturedCallbacks = [];
    mockRunQuery.mockClear();
    createQueryClient();
    useTracesStore.setState({
      filters: { ...EMPTY_FILTERS },
      rawQuery: null,
      selectedTraceId: null,
      selectedTraceSpans: [],
      selectedSpanId: null,
      viewMode: "list",
      drawerOpen: false,
    });
  });

  it("shows a user-friendly error with collapsible details when a search error occurs", async () => {
    const typeMismatchError =
      "Found 1 problem line 1:62: second argument of [COALESCE(attributes.span.duration.us, duration / 1000.0)] must be [long]";
    mockErrorsByHook = Array.from({ length: 20 }, () => typeMismatchError);

    const user = userEvent.setup();
    renderTracesPage();

    // Should show summarised error, not the raw error
    expect(screen.getByText("Query error")).toBeInTheDocument();
    expect(
      screen.getByText("A query type mismatch occurred. Results may still be usable."),
    ).toBeInTheDocument();

    // Raw error should be hidden initially
    expect(screen.queryByText(/second argument of \[COALESCE/)).not.toBeVisible();

    // Expanding details reveals the raw error
    await user.click(screen.getByRole("button", { name: "Show details" }));
    expect(screen.getByText(/second argument of \[COALESCE/)).toBeVisible();
  });

  it("summarizes all unique query error types", () => {
    mockErrorsByHook = Array.from({ length: 20 }, (_, index) =>
      index % 2 === 0
        ? "Found 1 problem line 1:62: second argument of [COALESCE(attributes.span.duration.us, duration / 1000.0)] must be [long]"
        : "parsing_exception: mismatched input",
    );

    renderTracesPage();

    expect(
      screen.getByText(/A query type mismatch occurred\. Results may still be usable\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/The query could not be parsed\./)).toBeInTheDocument();
  });
});

describe("TracesPage slot insight integration", () => {
  beforeEach(() => {
    capturedCallbacks = [];
    mockRunQuery.mockClear();
    createQueryClient();
    useTracesStore.setState({
      filters: { ...EMPTY_FILTERS },
      rawQuery: null,
      selectedTraceId: null,
      selectedTraceSpans: [],
      selectedSpanId: null,
      viewMode: "list",
      drawerOpen: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders InsightSlot indicators when slot insights are provided", async () => {
    // Mock usePageSlotInsights to return insights for the trace-search slot
    const mockModule = await import("../../src/hooks/usePageSlotInsights");
    vi.spyOn(mockModule, "usePageSlotInsights").mockReturnValue({
      summary: "Traces look healthy",
      insights: [
        { slotId: "trace-search", text: "Query is well-formed", severity: "info" },
        { slotId: "trace-results", text: "High error rate detected", severity: "warning" },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    renderTracesPage();

    // InsightSlot indicators should be rendered for slots with insights
    expect(screen.getByRole("button", { name: /view info insight/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view warning insight/i })).toBeInTheDocument();
  });

  it("does not render InsightSlot indicators when loading", async () => {
    const mockModule = await import("../../src/hooks/usePageSlotInsights");
    vi.spyOn(mockModule, "usePageSlotInsights").mockReturnValue({
      summary: null,
      insights: [{ slotId: "trace-search", text: "Query is well-formed", severity: "info" }],
      loading: true,
      error: null,
      refresh: vi.fn(),
    });

    renderTracesPage();

    // During loading, InsightSlot should not show indicators
    expect(screen.queryByRole("button", { name: /view info insight/i })).not.toBeInTheDocument();
  });
});

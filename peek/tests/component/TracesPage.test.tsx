import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";

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

// Collect onSuccess callbacks from each useEsqlQuery call; index 0 is the main search query
let capturedCallbacks: Array<((data: EsqlResponse, query: string) => void) | undefined> = [];
const mockRunQuery = vi.fn();
vi.mock("../../src/hooks/useEsqlQuery", () => ({
  useEsqlQuery: (opts: { onSuccess?: (data: EsqlResponse, query: string) => void }) => {
    capturedCallbacks.push(opts.onSuccess);
    return { runQuery: mockRunQuery, loading: false, error: null };
  },
}));

vi.mock("../../src/components/visualizations/WaterfallChart", () => ({ default: () => null }));
vi.mock("../../src/components/visualizations/TraceScatterChart", () => ({ default: () => null }));
vi.mock("../../src/components/visualizations/TraceServiceMap", () => ({ default: () => null }));
vi.mock("../../src/components/visualizations/DriftRadarMap", () => ({ default: () => null }));
vi.mock("../../src/components/visualizations/TimeSeriesChart", () => ({ default: () => null }));
vi.mock("../../src/components/traces/SpanDetailDrawer", () => ({ default: () => null }));

function isDriftRadarQuery(query: string): boolean {
  return (
    query.includes("FROM traces-*") &&
    !query.includes("parent.id IS NULL") &&
    !query.includes("STATS request_count")
  );
}

function LocationSearch() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

describe("TracesPage duration filter", () => {
  beforeEach(() => {
    mockRunQuery.mockClear();
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
    render(
      <MemoryRouter>
        <TracesPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText("Min (ms)"), "0");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(useTracesStore.getState().filters.minDurationMs).toBe(0);
  });

  it("applies a non-zero minimum duration", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TracesPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText("Min (ms)"), "100");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(useTracesStore.getState().filters.minDurationMs).toBe(100);
  });

  it("clears minDurationMs when input is empty", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TracesPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(useTracesStore.getState().filters.minDurationMs).toBeNull();
  });
});

describe("TracesPage empty states", () => {
  beforeEach(() => {
    capturedCallbacks = [];
    mockRunQuery.mockClear();
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
    render(
      <MemoryRouter>
        <TracesPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Search for traces to load the Drift Radar service map."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Search for traces")).not.toBeInTheDocument();
  });

  it("shows no-results guidance in list view when a search returns zero traces", () => {
    render(
      <MemoryRouter>
        <TracesPage />
      </MemoryRouter>,
    );

    act(() => {
      capturedCallbacks[0]?.({ columns: [], values: [] }, "FROM traces");
    });

    expect(
      screen.getByText(
        "No traces matched current filters. Adjust filters or widen the time range.",
      ),
    ).toBeInTheDocument();
  });
});

describe("TracesPage auto-run on quick filter changes", () => {
  beforeEach(() => {
    capturedCallbacks = [];
    mockRunQuery.mockClear();
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
    render(
      <MemoryRouter>
        <TracesPage />
      </MemoryRouter>,
    );

    mockRunQuery.mockClear();
    await user.type(screen.getByPlaceholderText("Min (ms)"), "50");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(mockRunQuery).toHaveBeenCalled();
  });

  it("auto-runs query when a status chip is toggled", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TracesPage />
      </MemoryRouter>,
    );

    mockRunQuery.mockClear();
    await user.click(screen.getByText("Error"));

    expect(mockRunQuery).toHaveBeenCalled();
    expect(useTracesStore.getState().filters.statusCodes).toContain("Error");
  });

  it("auto-runs query when a service is added", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TracesPage />
      </MemoryRouter>,
    );

    mockRunQuery.mockClear();
    await user.type(screen.getByPlaceholderText("Service name"), "my-service{enter}");

    expect(mockRunQuery).toHaveBeenCalled();
    expect(useTracesStore.getState().filters.services).toContain("my-service");
  });

  it("auto-runs query when a status chip pill is deleted", async () => {
    useTracesStore.setState({
      filters: { ...EMPTY_FILTERS, statusCodes: ["Error"] },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TracesPage />
      </MemoryRouter>,
    );

    mockRunQuery.mockClear();
    const deleteButton = screen.getByTestId("trace-status-chip-delete-error");
    await user.click(deleteButton);

    expect(mockRunQuery).toHaveBeenCalled();
    expect(useTracesStore.getState().filters.statusCodes).not.toContain("Error");
  });

  it("refreshes Drift Radar spans when quick filters change in Drift Radar mode", async () => {
    useTracesStore.setState({ viewMode: "driftRadar" });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TracesPage />
      </MemoryRouter>,
    );

    mockRunQuery.mockClear();
    await user.click(screen.getByText("Error"));

    const queries = mockRunQuery.mock.calls.map(([query]) => String(query));
    expect(queries.some(isDriftRadarQuery)).toBe(true);
  });
});

describe("TracesPage URL search params", () => {
  beforeEach(() => {
    capturedCallbacks = [];
    mockRunQuery.mockClear();
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

  it("hydrates key trace state from URL params", () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/traces?service=checkout-service&from=NOW()%20-%2015%20minutes&to=NOW()&view=scatter&traceId=abc123&rawQuery=FROM%20traces-*",
        ]}
      >
        <TracesPage />
      </MemoryRouter>,
    );

    const state = useTracesStore.getState();
    expect(state.filters.services).toEqual(["checkout-service"]);
    expect(state.filters.timeFrom).toBe("NOW() - 15 minutes");
    expect(state.filters.timeTo).toBe("NOW()");
    expect(state.viewMode).toBe("scatter");
    expect(state.selectedTraceId).toBe("abc123");
    expect(state.rawQuery).toBe("FROM traces-*");
  });

  it("writes view and service filter updates to URL params", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/traces"]}>
        <TracesPage />
        <LocationSearch />
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText("Service name"), "payments{enter}");
    await user.click(screen.getByText("Scatter"));

    expect(screen.getByTestId("location-search").textContent).toContain("service=payments");
    expect(screen.getByTestId("location-search").textContent).toContain("view=scatter");
  });
});

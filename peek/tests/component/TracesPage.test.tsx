import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

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
vi.mock("../../src/hooks/useEsqlQuery", () => ({
  useEsqlQuery: (opts: { onSuccess?: (data: EsqlResponse, query: string) => void }) => {
    capturedCallbacks.push(opts.onSuccess);
    return { runQuery: vi.fn(), loading: false, error: null };
  },
}));

vi.mock("../../src/components/visualizations/WaterfallChart", () => ({ default: () => null }));
vi.mock("../../src/components/visualizations/TraceScatterChart", () => ({ default: () => null }));
vi.mock("../../src/components/visualizations/TraceServiceMap", () => ({ default: () => null }));
vi.mock("../../src/components/visualizations/DriftRadarMap", () => ({ default: () => null }));
vi.mock("../../src/components/visualizations/TimeSeriesChart", () => ({ default: () => null }));
vi.mock("../../src/components/traces/SpanDetailDrawer", () => ({ default: () => null }));

describe("TracesPage duration filter", () => {
  beforeEach(() => {
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
    expect(screen.queryByText("Search for traces to see results")).not.toBeInTheDocument();
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

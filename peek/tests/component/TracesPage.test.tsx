import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import TracesPage from "../../src/components/traces/TracesPage";
import { useTracesStore } from "../../src/store/useTracesStore";
import { EMPTY_FILTERS } from "../../src/components/traces/traceQueryBuilder";

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value }: { value: string }) => <div data-testid="codemirror-mock">{value}</div>,
}));
vi.mock("@codemirror/lang-sql", () => ({ sql: () => [] }));
vi.mock("../../src/components/llmCompletionExtension", () => ({
  makeLLMCompletionExtension: () => [],
}));
vi.mock("../../src/hooks/useEsqlQuery", () => ({
  useEsqlQuery: () => ({
    runQuery: vi.fn(),
    loading: false,
    error: null,
  }),
}));
vi.mock("../../src/components/visualizations/WaterfallChart", () => ({ default: () => null }));
vi.mock("../../src/components/visualizations/TraceScatterChart", () => ({ default: () => null }));
vi.mock("../../src/components/visualizations/TraceServiceMap", () => ({ default: () => null }));
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

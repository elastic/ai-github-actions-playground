import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import DiscoverPage from "../../src/components/DiscoverPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useQueryStore } from "../../src/store/useQueryStore";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { resetAllStores } from "../fixtures/test-utils";

const queryMock = vi.fn();

vi.mock("../../src/services/es", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ElasticsearchClient: vi.fn().mockImplementation(() => ({
      query: queryMock,
    })),
    isElasticsearchError: (err: unknown) => {
      if (typeof err !== "object" || err === null) return false;
      const obj = err as Record<string, unknown>;
      return typeof obj.status === "number" && typeof obj.message === "string";
    },
  };
});

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value }: { value: string }) => <div data-testid="codemirror-mock">{value}</div>,
}));
vi.mock("@codemirror/lang-sql", () => ({
  sql: () => [],
  SQLDialect: { define: () => ({ language: [] }) },
}));
vi.mock("../../src/components/visualizations/DataTable", () => ({
  default: () => <div data-testid="datatable-mock" />,
}));
vi.mock("../../src/components/QueryPipelineSteps", () => ({
  default: ({ onRunStep }: { onRunStep: (query: string, stepIndex: number) => void }) => (
    <button type="button" onClick={() => onRunStep("FROM step-* | LIMIT 1", 0)}>
      Run step 1
    </button>
  ),
}));

describe("DiscoverPage", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({
      columns: [{ name: "@timestamp", type: "date" }],
      values: [["2025-06-15T12:00:00.000Z"]],
      executionTimeMs: 1,
    });
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://localhost:9200", apiKey: "test-key" });
    useConnectionStore.getState().setConnected(true);
  });

  it("adds successful queries to history", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /run query/i }));

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));
    expect(useQueryStore.getState().queryHistory).toEqual([
      "FROM logs-* | SORT @timestamp | LIMIT 50",
    ]);
  });

  it("can select a recent query and run it", async () => {
    const user = userEvent.setup();
    useQueryStore.getState().appendQueryToHistory("FROM metrics-* | LIMIT 5");
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /recent queries/i }));
    await user.click(screen.getByRole("menuitem", { name: "FROM metrics-* | LIMIT 5" }));
    expect(screen.getByTestId("codemirror-mock")).toHaveTextContent("FROM metrics-* | LIMIT 5");

    await user.click(screen.getByRole("button", { name: /run query/i }));
    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: "FROM metrics-* | LIMIT 5" }),
      expect.any(AbortSignal),
    );
  });

  it("stores the executed step query in history", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /run step 1/i }));

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: "FROM step-* | LIMIT 1" }),
      expect.any(AbortSignal),
    );
    expect(useQueryStore.getState().queryHistory[0]).toBe("FROM step-* | LIMIT 1");
  });

  it("expands a keyword field to show top values", async () => {
    const user = userEvent.setup();
    // First call: main query returns a keyword column
    queryMock.mockResolvedValueOnce({
      columns: [{ name: "status", type: "keyword" }],
      values: [["ok"], ["error"]],
      executionTimeMs: 1,
    });
    // Second call: insights query returns top values
    queryMock.mockResolvedValueOnce({
      columns: [
        { name: "status", type: "keyword" },
        { name: "value_count", type: "long" },
      ],
      values: [
        ["ok", 100],
        ["error", 42],
      ],
      executionTimeMs: 1,
    });

    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /run query/i }));
    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));

    // Expand the field insight
    const expandBtn = await screen.findByRole("button", {
      name: /expand insights for status/i,
    });
    await user.click(expandBtn);

    // Should show top values
    await waitFor(() => {
      expect(screen.getByText("ok")).toBeInTheDocument();
      expect(screen.getByText("100")).toBeInTheDocument();
      expect(screen.getByText("error")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
    });
  });

  it("allows toggling field insights with keyboard", async () => {
    const user = userEvent.setup();
    queryMock.mockResolvedValueOnce({
      columns: [{ name: "status", type: "keyword" }],
      values: [["ok"], ["error"]],
      executionTimeMs: 1,
    });
    queryMock.mockResolvedValueOnce({
      columns: [
        { name: "status", type: "keyword" },
        { name: "value_count", type: "long" },
      ],
      values: [
        ["ok", 100],
        ["error", 42],
      ],
      executionTimeMs: 1,
    });

    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /run query/i }));
    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));

    const expandBtn = await screen.findByRole("button", {
      name: /expand insights for status/i,
    });
    expandBtn.focus();
    expect(expandBtn).toHaveFocus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /collapse insights for status/i }),
      ).toBeInTheDocument();
      expect(screen.getByText("100")).toBeInTheDocument();
    });
  });

  it("expands a numeric field to show min/max/avg stats", async () => {
    const user = userEvent.setup();
    queryMock.mockResolvedValueOnce({
      columns: [{ name: "latency", type: "long" }],
      values: [[50]],
      executionTimeMs: 1,
    });
    queryMock.mockResolvedValueOnce({
      columns: [
        { name: "min_value", type: "long" },
        { name: "max_value", type: "long" },
        { name: "avg_value", type: "double" },
        { name: "total_count", type: "long" },
        { name: "null_count", type: "long" },
      ],
      values: [[10, 200, 55.5, 1000, 3]],
      executionTimeMs: 1,
    });

    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /run query/i }));
    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));

    const expandBtn = await screen.findByRole("button", {
      name: /expand insights for latency/i,
    });
    await user.click(expandBtn);

    await waitFor(() => {
      expect(screen.getByText("Min")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("Max")).toBeInTheDocument();
      expect(screen.getByText("200")).toBeInTheDocument();
      expect(screen.getByText("Avg")).toBeInTheDocument();
      expect(screen.getByText("55.5")).toBeInTheDocument();
      expect(screen.getByText("Count")).toBeInTheDocument();
      expect(screen.getByText("1000")).toBeInTheDocument();
      expect(screen.getByText("Nulls")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("collapses an expanded field insight", async () => {
    const user = userEvent.setup();
    queryMock.mockResolvedValueOnce({
      columns: [{ name: "status", type: "keyword" }],
      values: [["ok"]],
      executionTimeMs: 1,
    });
    queryMock.mockResolvedValueOnce({
      columns: [
        { name: "status", type: "keyword" },
        { name: "value_count", type: "long" },
      ],
      values: [["ok", 100]],
      executionTimeMs: 1,
    });

    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /run query/i }));
    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));

    const expandBtn = await screen.findByRole("button", {
      name: /expand insights for status/i,
    });
    await user.click(expandBtn);
    expect(await screen.findByText("100")).toBeInTheDocument();

    // Collapse
    const collapseBtn = screen.getByRole("button", {
      name: /collapse insights for status/i,
    });
    await user.click(collapseBtn);

    // Values should be hidden (Collapse animation)
    await waitFor(() => expect(screen.queryByText("100")).not.toBeVisible());
  });

  it("caches insight data and does not re-query on re-expand", async () => {
    const user = userEvent.setup();
    queryMock.mockResolvedValueOnce({
      columns: [{ name: "status", type: "keyword" }],
      values: [["ok"]],
      executionTimeMs: 1,
    });
    queryMock.mockResolvedValueOnce({
      columns: [
        { name: "status", type: "keyword" },
        { name: "value_count", type: "long" },
      ],
      values: [["ok", 100]],
      executionTimeMs: 1,
    });

    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /run query/i }));
    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));

    // Expand
    const expandBtn = await screen.findByRole("button", {
      name: /expand insights for status/i,
    });
    await user.click(expandBtn);
    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(2));

    // Collapse
    await user.click(screen.getByRole("button", { name: /collapse insights for status/i }));

    // Re-expand — should NOT fire another query
    await user.click(screen.getByRole("button", { name: /expand insights for status/i }));
    expect(queryMock).toHaveBeenCalledTimes(2); // still 2
  });

  it("populates _tstart and _tend params when referenced in the query", async () => {
    const user = userEvent.setup();
    useDashboardStore
      .getState()
      .setTimeRange({ from: "2025-06-15T11:00:00.000Z", to: "2025-06-15T12:00:00.000Z" });
    useQueryStore
      .getState()
      .setDiscoverQueryDraft(
        "FROM logs-* | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend | LIMIT 10",
      );

    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /run query/i }));

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "FROM logs-* | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend | LIMIT 10",
        params: expect.objectContaining({
          _tstart: "2025-06-15T11:00:00.000Z",
          _tend: "2025-06-15T12:00:00.000Z",
        }),
      }),
      expect.any(AbortSignal),
    );
  });

  it("creates a panel from the current query using Convert to Visualization", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    const convertButton = screen.getByRole("button", { name: /convert to visualization/i });
    await user.click(convertButton);

    const panels = useDashboardStore.getState().dashboard.panels;
    expect(panels.length).toBeGreaterThanOrEqual(1);
    const newPanel = panels[panels.length - 1]!;
    expect(newPanel.visualization).toBe("table");
    expect(newPanel.query).toBe("FROM logs-* | SORT @timestamp | LIMIT 50");
  });

  it("uses the draft query when creating a panel via Convert to Visualization", async () => {
    const user = userEvent.setup();
    useQueryStore.getState().setDiscoverQueryDraft("FROM metrics-* | LIMIT 100");

    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /convert to visualization/i }));

    const panels = useDashboardStore.getState().dashboard.panels;
    const newPanel = panels[panels.length - 1]!;
    expect(newPanel.query).toBe("FROM metrics-* | LIMIT 100");
  });

  it("shows the empty state before a query is run", () => {
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("No results yet")).toBeInTheDocument();
    expect(
      screen.getByText("Write an ES|QL query above and press Ctrl/Cmd+Enter to run it."),
    ).toBeInTheDocument();
  });

  it("disables Export CSV button when there is no result data", () => {
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    // The DataTable mock is rendered only when there are results,
    // so the export CSV button within DataTable should not be present
    expect(screen.queryByRole("button", { name: /export csv/i })).not.toBeInTheDocument();
  });

  it("disables the Run Query button when query is empty", () => {
    useQueryStore.getState().setDiscoverSessionQuery("   ");

    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /run query/i })).toBeDisabled();
  });
});

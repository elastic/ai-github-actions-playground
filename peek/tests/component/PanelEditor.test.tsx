import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PanelEditor from "../../src/components/PanelEditor";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useUIStore } from "../../src/store/useUIStore";
import { useQueryStore } from "../../src/store/useQueryStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

const queryMock = vi.fn();

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    query: queryMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

// Mock CodeMirror — it doesn't work in jsdom
vi.mock("@uiw/react-codemirror", () => ({
  default: () => <div data-testid="codemirror-mock" />,
}));
vi.mock("@codemirror/lang-sql", () => ({
  sql: () => [],
  SQLDialect: { define: () => ({ language: [] }) },
}));

// Mock Visualization component to avoid chart rendering
vi.mock("../../src/components/visualizations/Visualization", () => ({
  default: () => <div data-testid="visualization-mock" />,
}));
vi.mock("../../src/components/QueryPipelineSteps", () => ({
  default: ({ onRunStep }: { onRunStep: (query: string, stepIndex: number) => void }) => (
    <button type="button" onClick={() => onRunStep("FROM panel-step-* | LIMIT 2", 1)}>
      Run step 2
    </button>
  ),
}));

describe("PanelEditor", () => {
  let panelId: string;

  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({ columns: [], values: [], executionTimeMs: 1 });
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://localhost:9200", apiKey: "test-key" });
    useConnectionStore.getState().setConnected(true);
    useDashboardStore
      .getState()
      .setTimeRange({ from: "2025-06-15T11:00:00.000Z", to: "2025-06-15T12:00:00.000Z" });
    useDashboardStore.getState().addParameter({
      name: "service",
      label: "Service",
      type: "keyword",
      source: { mode: "text" },
      value: "web",
    });
    // Add a test panel and open it for editing
    panelId = "test-panel-editor";
    useDashboardStore.getState().addPanel({
      id: panelId,
      title: "Test Panel",
      query: "FROM logs-* | LIMIT 10",
      visualization: "timeseries",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });
    useUIStore.getState().setEditingPanelId(panelId);
  });

  it("renders the visualization type toggle buttons", () => {
    render(<PanelEditor />);

    expect(screen.getByTitle("Time Series")).toBeInTheDocument();
    expect(screen.getByTitle("Bar")).toBeInTheDocument();
    expect(screen.getByTitle("Table")).toBeInTheDocument();
    expect(screen.getByTitle("Stat")).toBeInTheDocument();
    expect(screen.getByTitle("Gauge")).toBeInTheDocument();
    expect(screen.getByTitle("Pie")).toBeInTheDocument();
    expect(screen.getByTitle("Heatmap")).toBeInTheDocument();
    expect(screen.getByTitle("Scatter")).toBeInTheDocument();
    expect(screen.getByTitle("Histogram")).toBeInTheDocument();
  });

  it("switching to table shows threshold controls instead of format options", async () => {
    const user = userEvent.setup();
    render(<PanelEditor />);

    expect(screen.getByText("Options")).toBeInTheDocument();
    await user.click(screen.getByTitle("Table"));
    // Table now supports threshold options so "Options" stays visible
    expect(screen.getByText("Options")).toBeInTheDocument();
    // Format-specific controls are not present for table
    expect(screen.queryByRole("combobox", { name: /unit/i })).not.toBeInTheDocument();
  });

  it("switching to heatmap hides format options", async () => {
    const user = userEvent.setup();
    render(<PanelEditor />);

    expect(screen.getByText("Options")).toBeInTheDocument();
    await user.click(screen.getByTitle("Heatmap"));
    expect(screen.queryByText("Options")).not.toBeInTheDocument();
  });

  it.each(["Scatter", "Histogram"])(
    "switching to %s keeps format options visible",
    async (vizTitle) => {
      const user = userEvent.setup();
      render(<PanelEditor />);

      await user.click(screen.getByTitle(vizTitle));
      expect(screen.getByText("Options")).toBeInTheDocument();
    },
  );

  it("Save button calls updatePanel with current panel state", async () => {
    const user = userEvent.setup();
    render(<PanelEditor />);

    const saveButton = screen.getByRole("button", { name: /save/i });
    await user.click(saveButton);

    // After save, editingPanelId should be cleared
    expect(useUIStore.getState().editingPanelId).toBeNull();
    // Panel should still exist
    const panel = useDashboardStore.getState().dashboard.panels.find((p) => p.id === panelId);
    expect(panel).toBeDefined();
    expect(panel?.title).toBe("Test Panel");
  });

  it("Delete Panel button removes the panel", async () => {
    const user = userEvent.setup();
    render(<PanelEditor />);

    const deleteButton = screen.getByRole("button", { name: /delete panel/i });
    await user.click(deleteButton);

    expect(useUIStore.getState().editingPanelId).toBeNull();
    expect(
      useDashboardStore.getState().dashboard.panels.find((p) => p.id === panelId),
    ).toBeUndefined();
  });

  it("Run Query sends _tstart/_tend and dashboard variable params when referenced", async () => {
    const user = userEvent.setup();
    useDashboardStore.getState().updatePanel(panelId, {
      query:
        "FROM logs-* | WHERE service.name == ?service | STATS COUNT(*) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)",
    });

    render(<PanelEditor />);

    await user.click(screen.getByRole("button", { name: /run query/i }));

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query:
          "FROM logs-* | WHERE service.name == ?service | STATS COUNT(*) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)",
        filter: {
          range: {
            "@timestamp": {
              gte: "2025-06-15T11:00:00.000Z",
              lte: "2025-06-15T12:00:00.000Z",
            },
          },
        },
        params: expect.arrayContaining([
          { _tstart: "2025-06-15T11:00:00.000Z" },
          { _tend: "2025-06-15T12:00:00.000Z" },
          { service: "web" },
        ]),
      }),
      expect.any(AbortSignal),
    );
  });

  it("can select a recent query and run it", async () => {
    const user = userEvent.setup();
    useQueryStore.getState().appendQueryToHistory("FROM metrics-* | LIMIT 5");
    render(<PanelEditor />);

    await user.click(screen.getByRole("button", { name: /recent queries/i }));
    await user.click(await screen.findByRole("menuitem", { name: "FROM metrics-* | LIMIT 5" }));
    await user.click(screen.getByRole("button", { name: /run query/i }));

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: "FROM metrics-* | LIMIT 5" }),
      expect.any(AbortSignal),
    );
  });

  it("stores the executed step query in history", async () => {
    const user = userEvent.setup();
    render(<PanelEditor />);

    await user.click(screen.getByRole("button", { name: /run step 2/i }));

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: "FROM panel-step-* | LIMIT 2" }),
      expect.any(AbortSignal),
    );
    expect(useQueryStore.getState().queryHistory[0]).toBe("FROM panel-step-* | LIMIT 2");
  });
});

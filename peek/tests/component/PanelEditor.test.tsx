import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PanelEditor from "../../src/components/PanelEditor";
import { useDashboardStore } from "../../src/store/useDashboardStore";

const makeStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

// Mock CodeMirror — it doesn't work in jsdom
vi.mock("@uiw/react-codemirror", () => ({
  default: () => <div data-testid="codemirror-mock" />,
}));
vi.mock("@codemirror/lang-sql", () => ({
  sql: () => [],
}));

// Mock Visualization component to avoid chart rendering
vi.mock("../../src/components/visualizations/Visualization", () => ({
  default: () => <div data-testid="visualization-mock" />,
}));

describe("PanelEditor", () => {
  let panelId: string;

  beforeEach(() => {
    useDashboardStore.getState().resetState();
    // Add a test panel and open it for editing
    panelId = "test-panel-editor";
    useDashboardStore.getState().addPanel({
      id: panelId,
      title: "Test Panel",
      query: "FROM logs-* | LIMIT 10",
      visualization: "timeseries",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });
    useDashboardStore.getState().setEditingPanelId(panelId);
  });

  it("renders the visualization type toggle buttons", () => {
    render(<PanelEditor />);

    expect(screen.getByTitle("Time Series")).toBeInTheDocument();
    expect(screen.getByTitle("Bar")).toBeInTheDocument();
    expect(screen.getByTitle("Table")).toBeInTheDocument();
    expect(screen.getByTitle("Stat")).toBeInTheDocument();
    expect(screen.getByTitle("Gauge")).toBeInTheDocument();
    expect(screen.getByTitle("Pie")).toBeInTheDocument();
  });

  it("switching to table hides format options (ChartOptionsEditor)", async () => {
    const user = userEvent.setup();
    render(<PanelEditor />);

    expect(screen.getByText("Options")).toBeInTheDocument();
    await user.click(screen.getByTitle("Table"));
    expect(screen.queryByText("Options")).not.toBeInTheDocument();
  });

  it("Save button calls updatePanel with current panel state", async () => {
    const user = userEvent.setup();
    render(<PanelEditor />);

    const saveButton = screen.getByRole("button", { name: /save/i });
    await user.click(saveButton);

    // After save, editingPanelId should be cleared
    expect(useDashboardStore.getState().editingPanelId).toBeNull();
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

    expect(useDashboardStore.getState().editingPanelId).toBeNull();
    expect(
      useDashboardStore.getState().dashboard.panels.find((p) => p.id === panelId),
    ).toBeUndefined();
  });
});

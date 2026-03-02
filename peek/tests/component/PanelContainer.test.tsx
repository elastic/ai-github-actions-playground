import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PanelContainer from "../../src/components/PanelContainer";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { resetAllStores } from "../fixtures/test-utils";
import type { PanelDefinition } from "../../src/types";

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

function MockVisualization({
  onExportReady,
}: {
  onExportReady?: (exportFn: (() => string) | null) => void;
}) {
  useEffect(() => {
    onExportReady?.(() => "data:image/png;base64,ZmFrZQ==");
    return () => onExportReady?.(null);
  }, [onExportReady]);
  return <div>Visualization mock</div>;
}

vi.mock("../../src/components/perses/PersesPanelRenderer", () => ({
  default: MockVisualization,
}));

describe("PanelContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });

    queryMock.mockResolvedValue({
      columns: [{ name: "value", type: "long" }],
      values: [[1]],
      executionTimeMs: 5,
    });
  });

  it("downloads PNG when export callback is provided", async () => {
    const user = userEvent.setup();
    const click = vi.fn();
    const anchor = { href: "", download: "", click } as unknown as HTMLAnchorElement;
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") return anchor;
      return originalCreateElement(tag);
    });

    const panel: PanelDefinition = {
      id: "panel-1",
      title: "Test Panel",
      query: "FROM logs-* | LIMIT 1",
      visualization: "timeseries",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    };

    render(<PanelContainer panel={panel} />);

    await screen.findByText("Visualization mock");

    // eslint-disable-next-line testing-library/no-node-access -- icon button lacks accessible name
    const downloadButton = screen.getByTestId("DownloadIcon").closest("button");
    expect(downloadButton).not.toBeNull();

    await waitFor(() => expect(downloadButton).toBeEnabled());
    await user.click(downloadButton!);

    expect(click).toHaveBeenCalledTimes(1);
    expect(anchor.href).toContain("data:image/png;base64,ZmFrZQ==");
    expect(anchor.download).toMatch(/^test-panel-\d{4}-\d{2}-\d{2}T/);

    createElementSpy.mockRestore();
  });

  it("exports CSV when the Export CSV button is clicked on a table panel", async () => {
    const user = userEvent.setup();
    const click = vi.fn();
    const anchor = { href: "", download: "", click } as unknown as HTMLAnchorElement;
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") return anchor;
      return originalCreateElement(tag);
    });
    const createObjectURL = vi.fn().mockReturnValue("blob:fake-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const panel: PanelDefinition = {
      id: "panel-csv",
      title: "My Table",
      query: "FROM logs-* | LIMIT 10",
      visualization: "table",
      layout: { x: 0, y: 0, w: 12, h: 4 },
    };

    render(<PanelContainer panel={panel} />);
    await screen.findByText("Visualization mock");

    const exportButton = screen.getByRole("button", { name: /export csv/i });
    await waitFor(() => expect(exportButton).toBeEnabled());
    await user.click(exportButton);

    expect(click).toHaveBeenCalledTimes(1);
    expect(anchor.download).toMatch(/^my-table-.*\.csv$/);

    createElementSpy.mockRestore();
  });

  it("sends merged _tstart, _tend, and dashboard variable params on query execution", async () => {
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

    const panel: PanelDefinition = {
      id: "panel-params",
      title: "Params Panel",
      query:
        "FROM logs-* | WHERE service.name == ?service | STATS COUNT(*) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)",
      visualization: "timeseries",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    };

    render(<PanelContainer panel={panel} />);

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query:
          "FROM logs-* | WHERE service.name == ? | STATS COUNT(*) BY BUCKET(@timestamp, 50, ?, ?)",
        params: ["web", "2025-06-15T11:00:00.000Z", "2025-06-15T12:00:00.000Z"],
      }),
      expect.any(AbortSignal),
    );
  });

  it("shows a loading spinner while the query is in flight", async () => {
    let resolveQuery!: (value: unknown) => void;
    queryMock.mockReturnValue(
      new Promise((resolve) => {
        resolveQuery = resolve;
      }),
    );

    const panel: PanelDefinition = {
      id: "panel-loading",
      title: "Loading Panel",
      query: "FROM logs-* | LIMIT 1",
      visualization: "timeseries",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    };

    render(<PanelContainer panel={panel} />);

    expect(await screen.findByRole("progressbar")).toBeInTheDocument();

    resolveQuery({ columns: [{ name: "v", type: "long" }], values: [[1]], executionTimeMs: 2 });

    await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
  });

  it("displays an error message when the query fails", async () => {
    queryMock.mockRejectedValue(new Error("something went wrong"));

    const panel: PanelDefinition = {
      id: "panel-error",
      title: "Error Panel",
      query: "FROM bad-* | LIMIT 1",
      visualization: "timeseries",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    };

    render(<PanelContainer panel={panel} />);

    expect(await screen.findByText("Error: something went wrong")).toBeInTheDocument();
  });

  it("re-fetches data when the Refresh button is clicked", async () => {
    const user = userEvent.setup();
    const panel: PanelDefinition = {
      id: "panel-refresh",
      title: "Refresh Panel",
      query: "FROM logs-* | LIMIT 1",
      visualization: "timeseries",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    };

    render(<PanelContainer panel={panel} />);

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));

    const refreshButton = screen.getByRole("button", { name: /refresh/i });
    await user.click(refreshButton);

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(2));
  });
});

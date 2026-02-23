import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PanelContainer from "../../src/components/PanelContainer";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { makeStorageMock } from "../fixtures/test-utils";
import type { PanelDefinition } from "../../src/types";

const queryMock = vi.fn();

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

vi.mock("../../src/components/visualizations/Visualization", () => ({
  default: MockVisualization,
}));

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

describe("PanelContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetState();
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
});

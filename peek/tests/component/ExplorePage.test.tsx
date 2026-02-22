import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import ExplorePage from "../../src/components/ExplorePage";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { useExplorerStore } from "../../src/store/useExplorerStore";
import { makeStorageMock } from "../fixtures/test-utils";

const { queryMock, listFieldsMock } = vi.hoisted(() => ({
  queryMock: vi.fn().mockResolvedValue({
    columns: [{ name: "timestamp", type: "date" }, { name: "metric", type: "double" }],
    values: [["2026-01-01T00:00:00.000Z", 1]],
    executionTimeMs: 1,
  }),
  listFieldsMock: vi
    .fn()
    .mockResolvedValue([{ name: "system.cpu.total.pct", type: "double", metricType: "gauge" }]),
}));

vi.mock("../../src/services/es", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/es")>(
    "../../src/services/es",
  );
  return {
    ...actual,
    ElasticsearchClient: vi.fn().mockImplementation(() => ({
      query: queryMock,
    })),
    listFields: listFieldsMock,
  };
});

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

describe("ExplorePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetState();
    useExplorerStore.getState().reset();
    useDashboardStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
    window.history.replaceState({}, "", "/");
  });

  it("restores explorer state from URL parameters on first render", async () => {
    window.history.replaceState(
      {},
      "",
      "/?index=metrics-system*&metric=system.cpu.total.pct&agg=p95&groupBy=host.name&from=now-24h&to=now&filter.host.name=%3D%3D:web-01",
    );

    render(<ExplorePage />);

    await waitFor(() => {
      const explorerState = useExplorerStore.getState();
      const dashboardState = useDashboardStore.getState();
      expect(explorerState.indexPattern).toBe("metrics-system*");
      expect(explorerState.selectedMetric).toBe("system.cpu.total.pct");
      expect(explorerState.aggregation).toBe("p95");
      expect(explorerState.groupBy).toBe("host.name");
      expect(explorerState.filters).toEqual([
        { field: "host.name", op: "==", value: "web-01" },
      ]);
      expect(dashboardState.dashboard.timeRange).toEqual({ from: "now-24h", to: "now" });
    });
  });

  it("coerces restored counter metric aggregation to count", async () => {
    listFieldsMock.mockResolvedValue([
      { name: "system.network.in.bytes", type: "long", metricType: "counter" },
    ]);
    window.history.replaceState(
      {},
      "",
      "/?index=metrics-system*&metric=system.network.in.bytes&agg=sum&from=now-24h&to=now",
    );

    render(<ExplorePage />);

    await waitFor(() => {
      const explorerState = useExplorerStore.getState();
      expect(explorerState.selectedMetric).toBe("system.network.in.bytes");
      expect(explorerState.metricType).toBe("counter");
      expect(explorerState.aggregation).toBe("count");
    });
  });
});

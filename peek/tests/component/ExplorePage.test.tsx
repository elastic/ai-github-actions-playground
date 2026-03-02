import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

import type * as EsService from "../../src/services/es";
import ExplorePage from "../../src/components/ExplorePage";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useExplorerStore } from "../../src/store/useExplorerStore";
import { resetAllStores } from "../fixtures/test-utils";

const RESTORE_URL =
  "/?index=metrics-system*&metric=system.cpu.total.pct&agg=p95&groupBy=host.name&from=now-24h&to=now&filter.host.name=%3D%3D:web-01";
const RESTORE_QS = RESTORE_URL.slice(RESTORE_URL.indexOf("?"));
const COUNTER_URL =
  "/?index=metrics-system*&metric=system.network.in.bytes&agg=sum&from=now-24h&to=now";
const COUNTER_QS = COUNTER_URL.slice(COUNTER_URL.indexOf("?"));
const NOT_FOUND_URL = "/?index=metrics-system*&metric=zzz.nonexistent&agg=avg&from=now-24h&to=now";
const NOT_FOUND_QS = NOT_FOUND_URL.slice(NOT_FOUND_URL.indexOf("?"));

const { queryMock, listFieldsMock } = vi.hoisted(() => ({
  queryMock: vi.fn().mockResolvedValue({
    columns: [
      { name: "timestamp", type: "date" },
      { name: "metric", type: "double" },
    ],
    values: [["2026-01-01T00:00:00.000Z", 1]],
    executionTimeMs: 1,
  }),
  listFieldsMock: vi
    .fn()
    .mockResolvedValue([{ name: "system.cpu.total.pct", type: "double", metricType: "gauge" }]),
}));

vi.mock("../../src/services/es", async () => {
  const actual = await vi.importActual<EsService>("../../src/services/es");
  return {
    ...actual,
    ElasticsearchClient: vi.fn().mockImplementation(() => ({
      query: queryMock,
    })),
    listFields: listFieldsMock,
  };
});

describe("ExplorePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    useExplorerStore.getState().reset();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
    window.history.replaceState({}, "", "/");
  });

  it("restores explorer state from URL parameters on first render", async () => {
    render(
      <MemoryRouter initialEntries={[RESTORE_URL]}>
        <NuqsTestingAdapter searchParams={RESTORE_QS} hasMemory>
          <ExplorePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const explorerState = useExplorerStore.getState();
      const dashboardState = useDashboardStore.getState();
      expect(explorerState.indexPattern).toBe("metrics-system*");
      expect(explorerState.selectedMetric).toBe("system.cpu.total.pct");
      expect(explorerState.aggregation).toBe("p95");
      expect(explorerState.groupBy).toBe("host.name");
      expect(explorerState.filters).toEqual([{ field: "host.name", op: "==", value: "web-01" }]);
      expect(dashboardState.dashboard.timeRange).toEqual({ from: "now-24h", to: "now" });
    });
  });

  it("coerces restored counter metric aggregation to count", async () => {
    listFieldsMock.mockResolvedValue([
      { name: "system.network.in.bytes", type: "long", metricType: "counter" },
    ]);
    render(
      <MemoryRouter initialEntries={[COUNTER_URL]}>
        <NuqsTestingAdapter searchParams={COUNTER_QS} hasMemory>
          <ExplorePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const explorerState = useExplorerStore.getState();
      expect(explorerState.selectedMetric).toBe("system.network.in.bytes");
      expect(explorerState.metricType).toBe("counter");
      expect(explorerState.aggregation).toBe("count");
    });
  });

  it("shows metric-not-found empty state for a non-existent metric URL", async () => {
    render(
      <MemoryRouter initialEntries={[NOT_FOUND_URL]}>
        <NuqsTestingAdapter searchParams={NOT_FOUND_QS} hasMemory>
          <ExplorePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Metric not found")).toBeInTheDocument();
    });

    expect(queryMock).not.toHaveBeenCalled();
  });
});

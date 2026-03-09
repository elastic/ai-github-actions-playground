import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQueryClient } from "../helpers/renderWithQueryClient";
import { MemoryRouter } from "react-router-dom";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import type * as EsService from "../../src/services/es";
import ExplorePage from "../../src/components/ExplorePage";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useExplorerStore } from "../../src/store/useExplorerStore";
import { resetAllStores } from "../fixtures/test-utils";

const { runQueryShortcutMock } = vi.hoisted(() => ({
  runQueryShortcutMock: vi.fn<[], void>(),
}));

vi.mock("../../src/components/queryEditorExtensions", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createEsqlQueryEditorExtensions: (runQuery: () => void) => {
      runQueryShortcutMock.mockImplementation(runQuery);
      return [];
    },
  };
});

vi.mock("@uiw/react-codemirror", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
    onCreateEditor?: () => void;
    extensions?: unknown[];
  }) => (
    <textarea
      aria-label="ES|QL query editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          runQueryShortcutMock();
        }
      }}
    />
  ),
}));

const RESTORE_URL =
  "/?index=metrics-system*&metric=system.cpu.total.pct&agg=p95&groupBy=host.name&from=now-24h&to=now&filter.host.name=%3D%3D:web-01";
const RESTORE_QS = RESTORE_URL.slice(RESTORE_URL.indexOf("?"));
const COUNTER_URL =
  "/?index=metrics-system*&metric=system.network.in.bytes&agg=sum&from=now-24h&to=now";
const COUNTER_QS = COUNTER_URL.slice(COUNTER_URL.indexOf("?"));
const NOT_FOUND_URL =
  "/?index=metrics-system*&metric=zzz.nonexistent&agg=avg&groupBy=host.name&from=now-24h&to=now";
const NOT_FOUND_QS = NOT_FOUND_URL.slice(NOT_FOUND_URL.indexOf("?"));
const { queryMock, listFieldsMock, defaultFields } = vi.hoisted(() => {
  const defaultFields = [{ name: "system.cpu.total.pct", type: "double", metricType: "gauge" }];
  return {
    queryMock: vi.fn().mockResolvedValue({
      columns: [
        { name: "timestamp", type: "date" },
        { name: "metric", type: "double" },
      ],
      values: [["2026-01-01T00:00:00.000Z", 1]],
      executionTimeMs: 1,
    }),
    listFieldsMock: vi.fn().mockResolvedValue(defaultFields),
    defaultFields,
  };
});

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
    runQueryShortcutMock.mockReset();
    listFieldsMock.mockResolvedValue(defaultFields);
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
    renderWithQueryClient(
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
    renderWithQueryClient(
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
    renderWithQueryClient(
      <MemoryRouter initialEntries={[NOT_FOUND_URL]}>
        <NuqsTestingAdapter searchParams={NOT_FOUND_QS} hasMemory>
          <ExplorePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Metric not found")).toBeInTheDocument();
    });

    expect(listFieldsMock).toHaveBeenCalled();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("does not query when metric is invalid and field loading fails", async () => {
    listFieldsMock.mockRejectedValueOnce(new Error("boom"));
    renderWithQueryClient(
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

  it("keeps typing decoupled from fetches and only queries on explicit commit/reset", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <MemoryRouter initialEntries={[RESTORE_URL]}>
        <NuqsTestingAdapter searchParams={RESTORE_QS} hasMemory>
          <ExplorePage />
        </NuqsTestingAdapter>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Expand ES|QL query section" }));

    const queryEditor = screen.getByRole("textbox", { name: "ES|QL query editor" });
    await user.clear(queryEditor);
    await user.type(
      queryEditor,
      "FROM metrics-system* | STATS avg_cpu = AVG(`system.cpu.total.pct`)",
    );
    expect(queryMock).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(queryEditor, { key: "Enter", ctrlKey: true });
    await waitFor(() => {
      expect(queryMock).toHaveBeenCalledTimes(2);
    });

    act(() => {
      useExplorerStore.getState().setRawQuery(null);
    });

    await waitFor(() => {
      expect(queryMock).toHaveBeenCalledTimes(3);
    });
  });
});

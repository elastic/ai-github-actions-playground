import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ServiceInventoryPage from "../../src/components/services/ServiceInventoryPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { usePageFiltersStore } from "../../src/store/usePageFiltersStore";
import { useTracesStore } from "../../src/store/useTracesStore";
import { resetAllStores } from "../fixtures/test-utils";

const mockRunQuery = vi.fn();

const INVENTORY_RESPONSE = {
  columns: [
    { name: "service.name", type: "keyword" },
    { name: "request_count", type: "long" },
    { name: "avg_latency_ms", type: "double" },
    { name: "error_count", type: "long" },
    { name: "error_rate", type: "double" },
    { name: "unique_routes", type: "long" },
    { name: "unique_span_names", type: "long" },
    { name: "top_route", type: "keyword" },
    { name: "top_span_name", type: "keyword" },
    { name: "top_error", type: "keyword" },
    { name: "language", type: "keyword" },
    { name: "environment", type: "keyword" },
  ],
  values: [
    [
      "frontend",
      1500,
      45.2,
      30,
      0.02,
      24,
      68,
      ["/products/:id"],
      ["GET /products/:id"],
      ["TimeoutError: upstream inventory"],
      ["nodejs"],
      ["prod"],
    ],
    [
      "backend-api",
      3200,
      120.5,
      320,
      0.1,
      40,
      102,
      ["/checkout"],
      ["POST /checkout"],
      ["Database timeout"],
      ["java"],
      ["prod"],
    ],
    [
      "payment-service",
      800,
      250.0,
      8,
      0.01,
      16,
      37,
      ["/payments/:id"],
      ["GET /payments/:id"],
      ["Card declined"],
      ["go"],
      ["staging"],
    ],
  ],
};

const SPARKLINE_RESPONSE = {
  columns: [
    { name: "service.name", type: "keyword" },
    { name: "bucket", type: "date" },
    { name: "request_count", type: "long" },
    { name: "avg_latency_ms", type: "double" },
    { name: "error_rate", type: "double" },
  ],
  values: [
    ["frontend", "2026-01-01T00:00:00.000Z", 100, 40.0, 0.01],
    ["frontend", "2026-01-01T00:03:00.000Z", 120, 50.0, 0.02],
    ["backend-api", "2026-01-01T00:00:00.000Z", 200, 110.0, 0.08],
    ["backend-api", "2026-01-01T00:03:00.000Z", 220, 130.0, 0.12],
    ["payment-service", "2026-01-01T00:00:00.000Z", 50, 240.0, 0.01],
    ["payment-service", "2026-01-01T00:03:00.000Z", 60, 260.0, 0.01],
  ],
};

vi.mock("../../src/hooks/useEsqlQuery", () => ({
  useEsqlQuery: (opts: {
    onSuccess: (data: unknown, executedQuery: string, executedStepIndex: number | null) => void;
  }) => ({
    runQuery: (query: string) => {
      mockRunQuery(query);
      const isSparkline = query.includes("BUCKET");
      opts.onSuccess(isSparkline ? SPARKLINE_RESPONSE : INVENTORY_RESPONSE, query, null);
    },
    loading: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

let queryClient: QueryClient;

function renderPage() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/services"]}>
        <Routes>
          <Route path="/services" element={<ServiceInventoryPage />} />
          <Route path="/traces" element={<div>Traces Route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ServiceInventoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
    usePageFiltersStore.getState().resetServiceFilters();
  });

  it("renders page header and empty state initially", () => {
    renderPage();
    expect(screen.getByText("Service Performance")).toBeInTheDocument();
    expect(screen.getByText("No service data loaded")).toBeInTheDocument();
    expect(
      screen.getByText("Click Search to discover services from your OpenTelemetry trace data."),
    ).toBeInTheDocument();
  });

  it("shows service table after clicking Search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    const inventoryTable = await screen.findByRole("table", { name: "Service inventory" });
    expect(within(inventoryTable).getByText("frontend")).toBeInTheDocument();
    expect(within(inventoryTable).getByText("backend-api")).toBeInTheDocument();
    expect(within(inventoryTable).getByText("payment-service")).toBeInTheDocument();
  });

  it("shows request counts for services", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    const inventoryTable = await screen.findByRole("table", { name: "Service inventory" });
    expect(within(inventoryTable).getByText("3,200")).toBeInTheDocument();
    expect(within(inventoryTable).getByText("1,500")).toBeInTheDocument();
    expect(within(inventoryTable).getByText("800")).toBeInTheDocument();
  });

  it("displays error rate chips with error color for high rates", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    const inventoryTable = await screen.findByRole("table", { name: "Service inventory" });
    expect(within(inventoryTable).getByText("10.0%")).toBeInTheDocument();
    expect(within(inventoryTable).getByTestId("error-rate-chip")).toBeInTheDocument();
  });

  it("shows service count after search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("3 services found")).toBeInTheDocument();
    });
  });

  it("has View Traces buttons for each service", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    const inventoryTable = await screen.findByRole("table", { name: "Service inventory" });
    const viewButtons = within(inventoryTable).getAllByRole("button", { name: /View traces for/i });
    expect(viewButtons).toHaveLength(3);
  });

  it("shows service metadata columns", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    const inventoryTable = await screen.findByRole("table", { name: "Service inventory" });
    expect(within(inventoryTable).getByText("java")).toBeInTheDocument();
    expect(within(inventoryTable).getAllByText("prod").length).toBeGreaterThan(0);
  });

  it("renders sparkline trend columns after search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    const inventoryTable = await screen.findByRole("table", { name: "Service inventory" });
    expect(within(inventoryTable).getByText("Requests trend")).toBeInTheDocument();
    expect(within(inventoryTable).getByText("Latency trend")).toBeInTheDocument();
    expect(within(inventoryTable).getByText("Error rate trend")).toBeInTheDocument();
  });

  it("fires a sparkline query scoped to discovered services after inventory query", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(mockRunQuery.mock.calls.some(([q]: [string]) => q.includes("BUCKET"))).toBe(true);
    });

    const sparklineQuery = mockRunQuery.mock.calls.find(([q]: [string]) =>
      q.includes("BUCKET"),
    )![0] as string;
    expect(sparklineQuery).toContain("frontend");
    expect(sparklineQuery).toContain("backend-api");
    expect(sparklineQuery).toContain("payment-service");
  });

  it("navigates to Traces with a clean service filter when View Traces is clicked", async () => {
    const user = userEvent.setup();
    // Pre-seed stale filters that should be wiped by the drilldown
    useTracesStore.getState().updateFilters({
      statusCodes: ["ERROR"],
      services: ["old-service"],
      timeFrom: "NOW() - 15 minutes",
      timeTo: "NOW()",
    });

    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => {
      expect(screen.getAllByText("View Traces")).toHaveLength(3);
    });

    await user.click(screen.getAllByRole("button", { name: /View traces for frontend/i })[0]);

    expect(screen.getByText("Traces Route")).toBeInTheDocument();

    const tracesFilters = useTracesStore.getState().filters;
    expect(tracesFilters.services).toEqual(["frontend"]);
    // Stale filters must be cleared
    expect(tracesFilters.statusCodes).toEqual([]);
    expect(tracesFilters.timeFrom).toBe("NOW() - 1 hour");
    expect(tracesFilters.timeTo).toBe("NOW()");
  });
});

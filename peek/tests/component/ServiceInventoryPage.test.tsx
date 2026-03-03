import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ServiceInventoryPage from "../../src/components/services/ServiceInventoryPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useServicesStore } from "../../src/store/useServicesStore";
import { useTracesStore } from "../../src/store/useTracesStore";
import { resetAllStores } from "../fixtures/test-utils";

const mockRunQuery = vi.fn();
vi.mock("../../src/hooks/useEsqlQuery", () => ({
  useEsqlQuery: (opts: {
    onSuccess: (data: unknown, executedQuery: string, executedStepIndex: number | null) => void;
  }) => ({
    runQuery: (query: string) => {
      mockRunQuery(query);
      opts.onSuccess(
        {
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
        },
        query,
        null,
      );
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
    useServicesStore.getState().resetFilters();
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

    await waitFor(() => {
      expect(screen.getByRole("table", { name: "Service inventory" })).toBeInTheDocument();
    });
    expect(screen.getAllByText("frontend").length).toBeGreaterThan(0);
    expect(screen.getAllByText("backend-api").length).toBeGreaterThan(0);
    expect(screen.getAllByText("payment-service").length).toBeGreaterThan(0);
  });

  it("shows request counts for services", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getAllByText("3,200").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("1,500").length).toBeGreaterThan(0);
    expect(screen.getAllByText("800").length).toBeGreaterThan(0);
  });

  it("displays error rate chips with error color for high rates", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getAllByText("10.0%").length).toBeGreaterThan(0);
    });
    // 10% error rate should have error color (> 5%) on at least one chip
    const highErrorChips = screen.getAllByText("10.0%");
    const errorChip = highErrorChips.find(
      // eslint-disable-next-line testing-library/no-node-access -- MUI Chip root
      (el) => el.closest(".MuiChip-root")?.classList.contains("MuiChip-colorError"),
    );
    expect(errorChip).toBeDefined();
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

    await waitFor(() => {
      const viewButtons = screen.getAllByText("View Traces");
      expect(viewButtons).toHaveLength(3);
    });
  });

  it("shows investigative metadata columns", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("Busiest Services")).toBeInTheDocument();
    });
    expect(screen.getAllByText("/checkout").length).toBeGreaterThan(0);
    expect(screen.getAllByText("POST /checkout").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Database timeout").length).toBeGreaterThan(0);
    expect(screen.getAllByText("java").length).toBeGreaterThan(0);
    expect(screen.getAllByText("prod").length).toBeGreaterThan(0);
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

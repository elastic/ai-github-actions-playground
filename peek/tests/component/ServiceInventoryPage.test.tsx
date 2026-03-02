import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ServiceInventoryPage from "../../src/components/services/ServiceInventoryPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useServicesStore } from "../../src/store/useServicesStore";
import { resetAllStores } from "../fixtures/test-utils";

const mockRunQuery = vi.fn();
vi.mock("../../src/hooks/useEsqlQuery", () => ({
  useEsqlQuery: (opts: { onSuccess: (data: unknown) => void }) => ({
    runQuery: (query: string) => {
      mockRunQuery(query);
      opts.onSuccess({
        columns: [
          { name: "service.name", type: "keyword" },
          { name: "request_count", type: "long" },
          { name: "avg_latency_ms", type: "double" },
          { name: "error_count", type: "long" },
          { name: "error_rate", type: "double" },
        ],
        values: [
          ["frontend", 1500, 45.2, 30, 0.02],
          ["backend-api", 3200, 120.5, 320, 0.1],
          ["payment-service", 800, 250.0, 8, 0.01],
        ],
      });
    },
    loading: false,
    error: null,
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/services"]}>
      <Routes>
        <Route path="/services" element={<ServiceInventoryPage />} />
      </Routes>
    </MemoryRouter>,
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
    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.getByText("No service data loaded")).toBeInTheDocument();
  });

  it("shows service table after clicking Search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByRole("table", { name: "Service inventory" })).toBeInTheDocument();
    });
    expect(screen.getByText("frontend")).toBeInTheDocument();
    expect(screen.getByText("backend-api")).toBeInTheDocument();
    expect(screen.getByText("payment-service")).toBeInTheDocument();
  });

  it("shows request counts for services", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("3,200")).toBeInTheDocument();
    });
    expect(screen.getByText("1,500")).toBeInTheDocument();
    expect(screen.getByText("800")).toBeInTheDocument();
  });

  it("displays error rate chips with error color for high rates", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("10.0%")).toBeInTheDocument();
    });
    // 10% error rate should have error color (> 5%)
    const highErrorChip = screen.getByText("10.0%");
    // eslint-disable-next-line testing-library/no-node-access -- MUI Chip root
    expect(highErrorChip.closest(".MuiChip-root")).toHaveClass("MuiChip-colorError");
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
});

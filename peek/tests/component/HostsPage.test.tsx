import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import HostsPage from "../../src/components/hosts/HostsPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { usePageFiltersStore } from "../../src/store/usePageFiltersStore";
import { resetAllStores } from "../fixtures/test-utils";

const INVENTORY_RESPONSE = {
  columns: [
    { name: "host_key", type: "keyword" },
    { name: "host_name", type: "keyword" },
    { name: "os_type", type: "keyword" },
    { name: "os_name", type: "keyword" },
    { name: "os_version", type: "keyword" },
    { name: "last_seen", type: "date" },
    { name: "cpu_utilization", type: "double" },
    { name: "memory_utilization", type: "double" },
    { name: "process_count", type: "long" },
    { name: "host_ip", type: "keyword" },
  ],
  values: [
    [
      "web-server-1::linux",
      "web-server-1",
      "linux",
      "Ubuntu",
      "22.04",
      "2026-01-01T00:00:00Z",
      0.45,
      0.72,
      120,
      "10.0.0.1",
    ],
    [
      "win-dc-1::windows",
      "win-dc-1",
      "windows",
      "Windows Server",
      "2022",
      "2026-01-01T00:01:00Z",
      0.2,
      0.55,
      250,
      "10.0.0.2",
    ],
  ],
};

// Mock useSimpleEsqlQuery to auto-return data
vi.mock("../../src/hooks/useSimpleEsqlQuery", () => ({
  useSimpleEsqlQuery: ({ query }: { query: string | null }) => {
    if (!query) {
      return { data: null, loading: false, error: null, refetch: vi.fn() };
    }
    // Only return inventory data for the inventory query (contains STATS host_name)
    if (query.includes("STATS")) {
      return { data: INVENTORY_RESPONSE, loading: false, error: null, refetch: vi.fn() };
    }
    // Time-series queries return empty data
    return {
      data: { columns: [], values: [] },
      loading: false,
      error: null,
      refetch: vi.fn(),
    };
  },
}));

// Mock EChart to avoid canvas errors in tests
vi.mock("@perses-dev/components", () => ({
  EChart: () => <div data-testid="echart" />,
}));

let queryClient: QueryClient;

function renderPage(path = "/hosts") {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/hosts" element={<HostsPage />} />
          <Route path="/hosts/linux" element={<HostsPage osType="linux" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HostsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
    usePageFiltersStore.getState().resetHostsFilters();
  });

  it("renders page header", () => {
    renderPage();
    expect(screen.getByText("Hosts")).toBeInTheDocument();
  });

  it("auto-loads and shows host table", async () => {
    renderPage();

    const table = await screen.findByRole("table", { name: "Host inventory" });
    expect(table).toBeInTheDocument();
    expect(screen.getByText("web-server-1")).toBeInTheDocument();
    expect(screen.getByText("win-dc-1")).toBeInTheDocument();
  });

  it("shows result count after auto-load", async () => {
    renderPage();
    expect(await screen.findByText("2 hosts found")).toBeInTheDocument();
  });

  it("shows overview cards with OS breakdown", async () => {
    renderPage();
    expect(await screen.findByText("Total Hosts")).toBeInTheDocument();
    expect(screen.getAllByText("Linux").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Windows").length).toBeGreaterThanOrEqual(1);
  });

  it("renders with OS-specific title when osType is provided", () => {
    renderPage("/hosts/linux");
    expect(screen.getByText("Linux Hosts")).toBeInTheDocument();
  });

  it("shows DateRangePicker in toolbar", async () => {
    renderPage();
    // The DateRangePicker renders a button with time range label
    await waitFor(() => {
      const timeButton = screen.getByRole("button", { name: /time range/i });
      expect(timeButton).toBeInTheDocument();
    });
  });

  it("resets filters when clicking Reset", async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for the page to load
    await screen.findByRole("table", { name: "Host inventory" });

    // Click reset
    await user.click(screen.getByRole("button", { name: "Reset" }));
    // After reset, filters should be back to defaults (the page still auto-loads)
    const store = usePageFiltersStore.getState();
    expect(store.hostsFilters.search).toBe("");
  });
});

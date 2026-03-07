import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import HostsPage from "../../src/components/hosts/HostsPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { usePageFiltersStore } from "../../src/store/usePageFiltersStore";
import { resetAllStores } from "../fixtures/test-utils";

const mockRunQuery = vi.fn();

const INVENTORY_RESPONSE = {
  columns: [
    { name: "host.id", type: "keyword" },
    { name: "host_name", type: "keyword" },
    { name: "os_type", type: "keyword" },
    { name: "os_name", type: "keyword" },
    { name: "os_version", type: "keyword" },
    { name: "last_seen", type: "date" },
    { name: "cpu_utilization", type: "double" },
    { name: "memory_utilization", type: "double" },
    { name: "disk_utilization", type: "double" },
    { name: "process_count", type: "long" },
  ],
  values: [
    [
      "host-1",
      "web-server-1",
      "linux",
      "Ubuntu",
      "22.04",
      "2026-01-01T00:00:00Z",
      0.45,
      0.72,
      0.31,
      120,
    ],
    [
      "host-2",
      "win-dc-1",
      "windows",
      "Windows Server",
      "2022",
      "2026-01-01T00:01:00Z",
      0.2,
      0.55,
      0.45,
      250,
    ],
  ],
};

vi.mock("../../src/hooks/useEsqlQuery", () => ({
  useEsqlQuery: (opts: {
    onSuccess: (data: unknown, executedQuery: string, executedStepIndex: number | null) => void;
  }) => ({
    runQuery: (query: string) => {
      mockRunQuery(query);
      opts.onSuccess(INVENTORY_RESPONSE, query, null);
    },
    loading: false,
    error: null,
    clearError: vi.fn(),
  }),
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

  it("renders page header and empty state initially", () => {
    renderPage();
    expect(screen.getByText("Hosts")).toBeInTheDocument();
    expect(screen.getByText("No host data loaded")).toBeInTheDocument();
  });

  it("shows host table after clicking Search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    const table = await screen.findByRole("table", { name: "Host inventory" });
    expect(table).toBeInTheDocument();
    expect(screen.getByText("web-server-1")).toBeInTheDocument();
    expect(screen.getByText("win-dc-1")).toBeInTheDocument();
  });

  it("shows result count after search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("2 hosts found")).toBeInTheDocument();
  });

  it("shows overview cards with OS breakdown after search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Total Hosts")).toBeInTheDocument();
    expect(screen.getAllByText("Linux").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Windows").length).toBeGreaterThanOrEqual(1);
  });

  it("renders with OS-specific title when osType is provided", () => {
    renderPage("/hosts/linux");
    expect(screen.getByText("Linux Hosts")).toBeInTheDocument();
  });

  it("resets search result when clicking Reset", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("table", { name: "Host inventory" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("No host data loaded")).toBeInTheDocument();
  });
});

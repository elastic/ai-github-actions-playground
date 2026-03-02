import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { MemoryRouter, useLocation } from "react-router-dom";

import IndicesPage from "../../src/components/IndicesPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useApiConsoleStore } from "../../src/store/useApiConsoleStore";
import { resetAllStores } from "../fixtures/test-utils";

const {
  getCatIndicesMock,
  getIndexMappingsMock,
  getIndexSettingsMock,
  getIndexStatsMock,
  getIndexDiskUsageMock,
} = vi.hoisted(() => ({
  getCatIndicesMock: vi.fn(),
  getIndexMappingsMock: vi.fn(),
  getIndexSettingsMock: vi.fn(),
  getIndexStatsMock: vi.fn(),
  getIndexDiskUsageMock: vi.fn(),
}));

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getCatIndices: getCatIndicesMock,
    getIndexMappings: getIndexMappingsMock,
    getIndexSettings: getIndexSettingsMock,
    getIndexStats: getIndexStatsMock,
    getIndexDiskUsage: getIndexDiskUsageMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

const SAMPLE_INDICES = [
  {
    index: "logs-app",
    health: "green",
    status: "open",
    pri: "1",
    rep: "0",
    "docs.count": "5000",
    "docs.deleted": "10",
    "store.size": "1048576",
    "pri.store.size": "1048576",
  },
  {
    index: "metrics-service_destination.1m.otel-default-2026.03.02-000001",
    health: "yellow",
    status: "open",
    pri: "1",
    rep: "1",
    "docs.count": "20000",
    "docs.deleted": "0",
    "store.size": "2097152",
    "pri.store.size": "1048576",
  },
  {
    index: ".system-index",
    health: "green",
    status: "open",
    pri: "1",
    rep: "0",
    "docs.count": "100",
    "docs.deleted": "0",
    "store.size": "10240",
    "pri.store.size": "10240",
  },
];

const SAMPLE_MAPPINGS = {
  "logs-app": {
    mappings: {
      properties: {
        "@timestamp": { type: "date" },
        message: { type: "text" },
        host: {
          properties: {
            name: { type: "keyword" },
          },
        },
      },
    },
  },
};

const SAMPLE_SETTINGS = {
  "logs-app": {
    settings: {
      index: {
        number_of_shards: "1",
        number_of_replicas: "0",
        creation_date: "1700000000000",
      },
    },
  },
};

const SAMPLE_STATS = {
  _all: {
    primaries: {
      docs: { count: 5000, deleted: 10 },
      store: { size_in_bytes: 1048576 },
      segments: { count: 3 },
      indexing: { index_total: 6000 },
      search: { query_total: 800 },
      merge: { total: 2 },
      refresh: { total: 50 },
      flush: { total: 5 },
    },
    total: {
      docs: { count: 5000, deleted: 10 },
      store: { size_in_bytes: 1048576 },
      segments: { count: 3 },
      indexing: { index_total: 6000 },
      search: { query_total: 800 },
      merge: { total: 2 },
      refresh: { total: 50 },
      flush: { total: 5 },
    },
  },
};

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <IndicesPage />
      <LocationDisplay />
    </MemoryRouter>,
  );
}

describe("IndicesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });

    getCatIndicesMock.mockResolvedValue(SAMPLE_INDICES);
    getIndexMappingsMock.mockResolvedValue(SAMPLE_MAPPINGS);
    getIndexSettingsMock.mockResolvedValue(SAMPLE_SETTINGS);
    getIndexStatsMock.mockResolvedValue(SAMPLE_STATS);
  });

  it("renders the page heading", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: /indices/i })).toBeInTheDocument();
  });

  it("lists indices alphabetically, hiding system indices by default", async () => {
    renderPage();
    // Wait for list to load
    const listEl = await screen.findByRole("list", { name: /index list/i });
    await within(listEl).findByText("logs-app");

    // Both visible non-system indices should appear in the list
    expect(within(listEl).getAllByText("logs-app").length).toBeGreaterThan(0);
    expect(
      within(listEl).getByText("metrics-service_destination.1m.otel-default-2026.03.02-000001"),
    ).toBeInTheDocument();
    expect(within(listEl).queryByText(".system-index")).not.toBeInTheDocument();
  });

  it("truncates long index names with a title tooltip", async () => {
    renderPage();
    const listEl = await screen.findByRole("list", { name: /index list/i });
    const longName = "metrics-service_destination.1m.otel-default-2026.03.02-000001";

    const metricsLabel = await within(listEl).findByText(longName);
    expect(metricsLabel).toHaveAttribute("title", longName);
  });

  it("shows system indices when the toggle is enabled", async () => {
    const user = userEvent.setup();
    renderPage();
    const listEl = await screen.findByRole("list", { name: /index list/i });
    await within(listEl).findByText("logs-app");

    expect(within(listEl).queryByText(".system-index")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /show system indices/i }));
    expect(await within(listEl).findByText(".system-index")).toBeInTheDocument();
  });

  it("filters the list by search term", async () => {
    const user = userEvent.setup();
    renderPage();
    const listEl = await screen.findByRole("list", { name: /index list/i });
    await within(listEl).findByText("logs-app");

    await user.type(screen.getByRole("textbox", { name: /search indices/i }), "metrics");

    expect(within(listEl).queryByText("logs-app")).not.toBeInTheDocument();
    expect(
      within(listEl).getByText("metrics-service_destination.1m.otel-default-2026.03.02-000001"),
    ).toBeInTheDocument();
  });

  it("clears the detail panel when search excludes the selected index", async () => {
    const user = userEvent.setup();
    renderPage();
    // Wait for detail panel to load with first index
    await screen.findByTestId("index-meta-health");

    // Type a search that matches nothing
    await user.type(screen.getByRole("textbox", { name: /search indices/i }), "non-existent");

    // Detail panel should show the empty state
    expect(screen.queryByTestId("index-meta-health")).not.toBeInTheDocument();
    expect(screen.getByText(/no index selected/i)).toBeInTheDocument();
  });

  it("shows overview metadata for the selected index", async () => {
    renderPage();
    // Wait for detail panel to load
    expect(await screen.findByTestId("index-meta-health")).toBeInTheDocument();
    expect(screen.getByTestId("index-meta-status")).toHaveTextContent("open");
    expect(screen.getByTestId("index-meta-pri")).toHaveTextContent("1");
    expect(screen.getByTestId("index-meta-rep")).toHaveTextContent("0");
    expect(screen.getByTestId("index-meta-docs-count")).toHaveTextContent("5,000");
    expect(screen.getByTestId("index-meta-store-size")).toHaveTextContent("1.0 MB");
  });

  it("truncates the detail panel heading with a title tooltip for long names", async () => {
    const user = userEvent.setup();
    renderPage();
    const listEl = await screen.findByRole("list", { name: /index list/i });
    await within(listEl).findByText("logs-app");

    const longName = "metrics-service_destination.1m.otel-default-2026.03.02-000001";
    await user.click(within(listEl).getByText(longName));

    const heading = await screen.findByRole("heading", { level: 2, name: longName });
    expect(heading).toHaveAttribute("title", longName);
  });

  it("switches to the Mappings tab and shows field list", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("index-meta-health"); // wait for detail load

    await user.click(screen.getByRole("tab", { name: /mappings/i }));
    expect(await screen.findByText("@timestamp")).toBeInTheDocument();
    expect(screen.getByText("message")).toBeInTheDocument();
    expect(screen.getByText("host.name")).toBeInTheDocument();
  });

  it("switches to the Settings tab and shows settings rows", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("index-meta-health");

    await user.click(screen.getByRole("tab", { name: /settings/i }));
    expect(await screen.findByText(/index\.number_of_shards/i)).toBeInTheDocument();
  });

  it("switches to the Stats tab and shows disk usage", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("index-meta-health");

    await user.click(screen.getByRole("tab", { name: /stats/i }));
    expect(await screen.findByTestId("index-stats-store-total")).toHaveTextContent("1.0 MB");
    expect(screen.getByTestId("index-stats-docs-count")).toHaveTextContent("5,000");
    expect(screen.getByTestId("index-stats-segments")).toHaveTextContent("3");
  });

  it("shows an error alert when the API call fails", async () => {
    getCatIndicesMock.mockRejectedValue({ status: 403, message: "Forbidden" });

    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
  });

  it("has no accessibility violations on initial render", async () => {
    const { container } = renderPage();
    // Wait for the detail panel to load (both list and detail are visible)
    await screen.findByTestId("index-meta-health");

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("shows Disk Usage tab with analyze button and renders field breakdown", async () => {
    const user = userEvent.setup();
    getIndexDiskUsageMock.mockResolvedValue({
      _shards: { total: 1, successful: 1, failed: 0 },
      "logs-app": {
        store_size_in_bytes: 524288,
        all_fields: { total_in_bytes: 500000 },
        fields: {
          message: { total_in_bytes: 300000, inverted_index: { total_in_bytes: 200000 } },
          "@timestamp": { total_in_bytes: 200000, doc_values_in_bytes: 150000 },
        },
      },
    });

    renderPage();
    await screen.findByTestId("index-meta-health");

    await user.click(screen.getByRole("tab", { name: /disk usage/i }));
    // Should show the analyze button (lazy load since it's expensive)
    const analyzeBtn = await screen.findByRole("button", { name: /analyze disk usage/i });
    await user.click(analyzeBtn);

    // Verify field-level results render
    expect(await screen.findByTestId("disk-usage-total")).toHaveTextContent("512 KB");
    expect(screen.getByTestId("disk-usage-all-fields")).toHaveTextContent("488 KB");
    expect(screen.getByText("message")).toBeInTheDocument();
    expect(screen.getByText("@timestamp")).toBeInTheDocument();
  });

  it("navigates to Console with a mapping draft when Inspect in Console is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("index-meta-health");

    await user.click(screen.getByRole("button", { name: /inspect in console/i }));

    expect(useApiConsoleStore.getState().consoleDraft).toEqual({
      method: "GET",
      path: "/logs-app/_mapping",
    });
    expect(screen.getByTestId("location")).toHaveTextContent("/console");
  });
});

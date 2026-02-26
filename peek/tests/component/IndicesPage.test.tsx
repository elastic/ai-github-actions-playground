import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";

import IndicesPage from "../../src/components/IndicesPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

const { getCatIndicesMock, getIndexMappingsMock, getIndexSettingsMock, getIndexStatsMock } =
  vi.hoisted(() => ({
    getCatIndicesMock: vi.fn(),
    getIndexMappingsMock: vi.fn(),
    getIndexSettingsMock: vi.fn(),
    getIndexStatsMock: vi.fn(),
  }));

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getCatIndices: getCatIndicesMock,
    getIndexMappings: getIndexMappingsMock,
    getIndexSettings: getIndexSettingsMock,
    getIndexStats: getIndexStatsMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

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
    index: "metrics-host",
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

function renderPage() {
  return render(
    <MemoryRouter>
      <IndicesPage />
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

    // Both visible non-system indices should appear in the list
    expect(within(listEl).getAllByText("logs-app").length).toBeGreaterThan(0);
    expect(within(listEl).getByText("metrics-host")).toBeInTheDocument();
    expect(within(listEl).queryByText(".system-index")).not.toBeInTheDocument();
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
    expect(within(listEl).getByText("metrics-host")).toBeInTheDocument();
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
    expect(results.violations).toHaveLength(0);
  });
});

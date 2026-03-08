import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import TransformsPage from "../../src/components/TransformsPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const { getTransformsMock, getTransformStatsMock } = vi.hoisted(() => ({
  getTransformsMock: vi.fn(),
  getTransformStatsMock: vi.fn(),
}));

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getTransforms: getTransformsMock,
    getTransformStats: getTransformStatsMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

const TRANSFORMS_RESPONSE = {
  count: 2,
  transforms: [
    {
      id: "ecommerce-summary",
      description: "Summarize ecommerce transactions",
      source: { index: ["ecommerce-events"] },
      dest: { index: "ecommerce-summary" },
      frequency: "5m",
      sync: { time: { field: "@timestamp", delay: "60s" } },
      settings: { max_page_search_size: 500 },
    },
    {
      id: "batch-job",
      description: "One-time batch aggregation",
      source: { index: ["raw-data"] },
      dest: { index: "batch-output" },
    },
  ],
};

const STATS_RESPONSE = {
  count: 2,
  transforms: [
    {
      id: "ecommerce-summary",
      state: "started",
      health: { status: "green" },
      node: { id: "abc", name: "node-1" },
      stats: {
        documents_processed: 1250000,
        documents_indexed: 42000,
        search_failures: 0,
        index_failures: 0,
        search_time_in_ms: 45200,
        index_time_in_ms: 12800,
        processing_time_in_ms: 58000,
        exponential_avg_checkpoint_duration_ms: 3200,
      },
      checkpointing: {
        last: { checkpoint: 287 },
      },
    },
    {
      id: "batch-job",
      state: "failed",
      health: { status: "red" },
      stats: {
        documents_processed: 500,
        documents_indexed: 100,
        search_failures: 3,
        index_failures: 1,
        search_time_in_ms: 0,
        index_time_in_ms: 0,
        processing_time_in_ms: 0,
        exponential_avg_checkpoint_duration_ms: 0,
      },
      checkpointing: {
        last: { checkpoint: 0 },
      },
    },
  ],
};

describe("TransformsPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("renders transforms table with data from both APIs", async () => {
    getTransformsMock.mockResolvedValue(TRANSFORMS_RESPONSE);
    getTransformStatsMock.mockResolvedValue(STATS_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TransformsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("ecommerce-summary");
    expect(screen.getByText("batch-job")).toBeInTheDocument();
  });

  it("shows KPI cards with correct counts", async () => {
    getTransformsMock.mockResolvedValue(TRANSFORMS_RESPONSE);
    getTransformStatsMock.mockResolvedValue(STATS_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TransformsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("ecommerce-summary");

    expect(screen.getByText("Total Transforms")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Stopped")).toBeInTheDocument();
    expect(screen.getByText("Health Issues")).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 6 });
    expect(headings.map((h) => h.textContent?.trim())).toEqual(
      expect.arrayContaining(["2", "1", "1", "0"]),
    );
  });

  it("distinguishes continuous and batch transforms", async () => {
    getTransformsMock.mockResolvedValue(TRANSFORMS_RESPONSE);
    getTransformStatsMock.mockResolvedValue(STATS_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TransformsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("ecommerce-summary");
    expect(screen.getByText("continuous")).toBeInTheDocument();
    expect(screen.getByText("batch")).toBeInTheDocument();
  });

  it("displays failure counts in red for non-zero failures", async () => {
    getTransformsMock.mockResolvedValue(TRANSFORMS_RESPONSE);
    getTransformStatsMock.mockResolvedValue(STATS_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TransformsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("ecommerce-summary");

    const batchRow = screen.getByText("batch-job").closest("tr");
    expect(batchRow).not.toBeNull();
    const failureCounts = within(batchRow!).getByText("3 / 1");
    expect(window.getComputedStyle(failureCounts).fontWeight).toBe("700");
  });

  it("shows empty state when no transforms exist", async () => {
    getTransformsMock.mockResolvedValue({ count: 0, transforms: [] });
    getTransformStatsMock.mockResolvedValue({ count: 0, transforms: [] });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TransformsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("No transforms found");
  });

  it("filters by search term", async () => {
    getTransformsMock.mockResolvedValue(TRANSFORMS_RESPONSE);
    getTransformStatsMock.mockResolvedValue(STATS_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TransformsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("ecommerce-summary");

    const searchInput = screen.getByLabelText("Search by transform ID");
    fireEvent.change(searchInput, { target: { value: "batch" } });

    await waitFor(() => {
      expect(screen.getByText("batch-job")).toBeInTheDocument();
      expect(screen.queryByText("ecommerce-summary")).not.toBeInTheDocument();
    });
  });

  it("shows error alert on fetch failure", async () => {
    getTransformsMock.mockRejectedValue({ status: 500, message: "Internal error" });
    getTransformStatsMock.mockRejectedValue({ status: 500, message: "Internal error" });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TransformsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("Internal error");
  });

  it("opens detail drawer when a row is clicked", async () => {
    getTransformsMock.mockResolvedValue(TRANSFORMS_RESPONSE);
    getTransformStatsMock.mockResolvedValue(STATS_RESPONSE);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TransformsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("ecommerce-summary");

    // Click on the row for ecommerce-summary
    fireEvent.click(screen.getByText("ecommerce-summary"));

    // The detail drawer should show configuration
    await screen.findByText("Configuration");
    expect(screen.getByText("Performance")).toBeInTheDocument();
    expect(screen.getAllByText("Checkpoint").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Failures")).toBeInTheDocument();
  });
});

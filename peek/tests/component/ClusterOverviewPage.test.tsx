import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import ClusterOverviewPage from "../../src/components/ClusterOverviewPage";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

const getClusterInfoMock = vi.fn();
const getClusterHealthMock = vi.fn();
const getDataStreamsMock = vi.fn();
const resolveIndexMock = vi.fn();
const rawRequestMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getClusterInfo: getClusterInfoMock,
    getClusterHealth: getClusterHealthMock,
    getDataStreams: getDataStreamsMock,
    resolveIndex: resolveIndexMock,
    rawRequest: rawRequestMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

const CLUSTER_INFO = {
  cluster_name: "test-cluster",
  cluster_uuid: "abc-123-def",
  name: "node-1",
  tagline: "You Know, for Search",
  version: {
    number: "8.14.0",
    build_flavor: "default",
    build_hash: "abcdef1234567890",
    build_date: "2024-01-01T00:00:00Z",
    build_snapshot: false,
    lucene_version: "9.10.0",
    minimum_wire_compatibility_version: "7.17.0",
    minimum_index_compatibility_version: "7.0.0",
  },
};

function mockFleetRawRequest() {
  rawRequestMock.mockImplementation((_method: string, url: string) => {
    // Fleet server status
    if (url.includes("metrics-fleet_server.agent_status")) {
      return Promise.resolve({
        status: 200,
        body: {
          hits: {
            total: { value: 1 },
            hits: [
              {
                _source: {
                  fleet: {
                    agents: {
                      total: 10,
                      healthy: 8,
                      unhealthy: 1,
                      offline: 1,
                      updating: 0,
                      inactive: 0,
                      enrolled: 10,
                      unenrolled: 0,
                      unhealthy_reason: { input: 0, output: 1, other: 0 },
                    },
                  },
                  "@timestamp": "2026-02-23T00:00:00Z",
                },
              },
            ],
          },
        },
      });
    }
    // Elastic agent inventory
    if (url.includes("logs-elastic_agent")) {
      return Promise.resolve({
        status: 200,
        body: { aggregations: { agents: { buckets: [] } } },
      });
    }
    return Promise.resolve({ status: 200, body: { hits: { hits: [] } } });
  });
}

describe("ClusterOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDashboardStore.getState().resetState();
    useDashboardStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("renders cluster info with fleet status after loading", async () => {
    getClusterInfoMock.mockResolvedValue(CLUSTER_INFO);
    getClusterHealthMock.mockResolvedValue({
      status: "green",
      number_of_nodes: 3,
      number_of_data_nodes: 2,
      active_primary_shards: 12,
      unassigned_shards: 0,
    });
    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        { name: "logs-a", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
        { name: "logs-b", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
      ],
    });
    resolveIndexMock.mockResolvedValue({
      indices: [{ name: "idx-1" }, { name: "idx-2" }, { name: "idx-3" }],
      aliases: [{ name: "alias-1" }],
      data_streams: [],
    });
    mockFleetRawRequest();

    render(
      <MemoryRouter>
        <ClusterOverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("test-cluster")).toBeInTheDocument();
    });
    expect(screen.getByText("8.14.0")).toBeInTheDocument();
    expect(screen.getByText("Status: GREEN")).toBeInTheDocument();
    expect(screen.getByText("Nodes: 3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // data stream count
    expect(screen.getByText("3")).toBeInTheDocument(); // index count
    // Fleet section uses server status metrics
    expect(screen.getByText("Total: 10")).toBeInTheDocument();
    expect(screen.getByText("Healthy: 8")).toBeInTheDocument();
    expect(screen.getByText("View Fleet →")).toBeInTheDocument();
  });

  it("shows error alert on failure", async () => {
    getClusterInfoMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    getClusterHealthMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    getDataStreamsMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    resolveIndexMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    rawRequestMock.mockRejectedValue({ status: 401, message: "Unauthorized" });

    render(
      <MemoryRouter>
        <ClusterOverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Unauthorized");
    });
  });

  it("refreshes data when Refresh button is clicked", async () => {
    const user = userEvent.setup();
    getClusterInfoMock.mockResolvedValue(CLUSTER_INFO);
    getClusterHealthMock.mockResolvedValue({
      status: "yellow",
      number_of_nodes: 2,
      number_of_data_nodes: 1,
      active_primary_shards: 4,
      unassigned_shards: 1,
    });
    getDataStreamsMock.mockResolvedValue({ data_streams: [] });
    resolveIndexMock.mockResolvedValue({ indices: [], aliases: [], data_streams: [] });
    mockFleetRawRequest();

    render(
      <MemoryRouter>
        <ClusterOverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("test-cluster")).toBeInTheDocument();
    });

    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        { name: "logs-new", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
      ],
    });

    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument(); // updated data stream count
    });
  });

  it("shows unavailable metrics and warning on partial failures", async () => {
    getClusterInfoMock.mockResolvedValue(CLUSTER_INFO);
    getClusterHealthMock.mockResolvedValue({
      status: "yellow",
      number_of_nodes: 2,
      number_of_data_nodes: 1,
      active_primary_shards: 5,
      unassigned_shards: 2,
    });
    getDataStreamsMock.mockRejectedValue({ status: 403, message: "Forbidden" });
    resolveIndexMock.mockRejectedValue({ status: 403, message: "Forbidden" });
    rawRequestMock.mockRejectedValue({ status: 403, message: "Forbidden" });

    render(
      <MemoryRouter>
        <ClusterOverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("test-cluster")).toBeInTheDocument();
    });
    expect(screen.getByText(/partial data loaded/i)).toBeInTheDocument();
    // Data streams, Indices, Aliases show unavailable; Fleet shows "No Fleet data available."
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(2);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

import ClusterOverviewPage from "../../src/components/ClusterOverviewPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const getClusterInfoMock = vi.fn();
const getClusterHealthMock = vi.fn();
const getClusterStatsMock = vi.fn();
const getNodesMock = vi.fn();
const getNodeStatsMock = vi.fn();
const getDataStreamsMock = vi.fn();
const resolveIndexMock = vi.fn();
const rawRequestMock = vi.fn();
const getPendingTasksMock = vi.fn();
const getIlmExplainAllMock = vi.fn();
const getTasksDetailedMock = vi.fn();
const getIlmPoliciesMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getClusterInfo: getClusterInfoMock,
    getClusterHealth: getClusterHealthMock,
    getClusterStats: getClusterStatsMock,
    getNodes: getNodesMock,
    getNodeStats: getNodeStatsMock,
    getDataStreams: getDataStreamsMock,
    resolveIndex: resolveIndexMock,
    getPendingTasks: getPendingTasksMock,
    getIlmExplainAll: getIlmExplainAllMock,
    getTasksDetailed: getTasksDetailedMock,
    getIlmPolicies: getIlmPoliciesMock,
    rawRequest: rawRequestMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

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

const CLUSTER_STATS = {
  nodes: { count: { total: 3 } },
  indices: {
    count: 12,
    shards: { total: 48 },
    docs: { count: 1200 },
    store: { size_in_bytes: 5_368_709_120 },
  },
};

const NODES_INFO = {
  nodes: {
    node_a: { name: "node-a", roles: ["master", "data_hot"] },
    node_b: { name: "node-b", roles: ["data_hot", "ingest"] },
  },
};

const NODE_STATS = {
  nodes: {
    node_a: {
      os: { cpu: { percent: 45 } },
      jvm: { mem: { heap_used_percent: 62 } },
      fs: { total: { total_in_bytes: 1000, available_in_bytes: 250 } },
      indices: { docs: { count: 650 }, shard_stats: { total_count: 20 } },
    },
    node_b: {
      os: { cpu: { percent: 35 } },
      jvm: { mem: { heap_used_percent: 40 } },
      fs: { total: { total_in_bytes: 1000, available_in_bytes: 500 } },
      indices: { docs: { count: 550 }, shard_stats: { total_count: 28 } },
    },
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
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });

    getClusterInfoMock.mockResolvedValue(CLUSTER_INFO);
    getClusterHealthMock.mockResolvedValue({
      status: "green",
      number_of_nodes: 3,
      number_of_data_nodes: 2,
      active_primary_shards: 12,
      unassigned_shards: 0,
    });
    getClusterStatsMock.mockResolvedValue(CLUSTER_STATS);
    getNodesMock.mockResolvedValue(NODES_INFO);
    getNodeStatsMock.mockResolvedValue(NODE_STATS);
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
    getPendingTasksMock.mockResolvedValue({ tasks: [] });
    getIlmExplainAllMock.mockResolvedValue({ indices: {} });
    getTasksDetailedMock.mockResolvedValue({ nodes: {} });
    getIlmPoliciesMock.mockResolvedValue({});
    mockFleetRawRequest();
  });

  it("renders cluster info with nodes and fleet status after loading", async () => {
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
    expect(screen.getByText("Discovered nodes: 3")).toBeInTheDocument();
    expect(screen.getByText("master: 1")).toBeInTheDocument();
    expect(screen.getByText("data_hot: 2")).toBeInTheDocument();
    expect(screen.getByText("node-a")).toBeInTheDocument();
    expect(screen.getByText("node-b")).toBeInTheDocument();
    expect(screen.getByText("5.0 GB")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // data stream count
    expect(screen.getByText("3")).toBeInTheDocument(); // index count
    // Fleet section uses server status metrics
    expect(screen.getByText("Total: 10")).toBeInTheDocument();
    expect(screen.getByText("Healthy: 8")).toBeInTheDocument();
    expect(screen.getByText("View Fleet →")).toBeInTheDocument();
  });

  it("shows error alert on total failure", async () => {
    getClusterInfoMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    getClusterHealthMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    getClusterStatsMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    getNodesMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    getNodeStatsMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
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
      expect(getDataStreamsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("shows unavailable metrics and warning on partial failures", async () => {
    getClusterStatsMock.mockRejectedValue({ status: 403, message: "Forbidden" });
    getNodesMock.mockRejectedValue({ status: 403, message: "Forbidden" });
    getNodeStatsMock.mockRejectedValue({ status: 403, message: "Forbidden" });

    render(
      <MemoryRouter>
        <ClusterOverviewPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("test-cluster")).toBeInTheDocument();
    });

    expect(screen.getByText(/partial data loaded/i)).toBeInTheDocument();
    expect(screen.getByText(/cluster stats, nodes, node stats/i)).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(5);
  });

  it("navigates to detail pages when clickable cards are clicked", async () => {
    const user = userEvent.setup();

    function LocationDisplay() {
      const location = useLocation();
      return <div data-testid="location">{location.pathname}</div>;
    }

    const renderOverviewPage = () =>
      render(
        <MemoryRouter initialEntries={["/cluster-overview"]}>
          <Routes>
            <Route path="/cluster-overview" element={<ClusterOverviewPage />} />
            <Route path="*" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>,
      );

    const { unmount } = renderOverviewPage();
    await waitFor(() => {
      expect(screen.getByText("test-cluster")).toBeInTheDocument();
    });

    // Verify drill-down buttons exist with correct aria labels
    expect(screen.getByRole("button", { name: "View Health" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Data Streams" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Indices" })).toBeInTheDocument();

    // Click Data Streams card and verify navigation
    await user.click(screen.getByRole("button", { name: "View Data Streams" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/data-streams");
    unmount();

    const { unmount: unmountHealth } = renderOverviewPage();
    await waitFor(() => {
      expect(screen.getByText("test-cluster")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "View Health" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/cluster-health");
    unmountHealth();

    renderOverviewPage();
    await waitFor(() => {
      expect(screen.getByText("test-cluster")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "View Indices" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/indices");
  });
});

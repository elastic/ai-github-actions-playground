import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ClusterOverviewPage from "../../src/components/ClusterOverviewPage";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

const getClusterInfoMock = vi.fn();
const getClusterHealthMock = vi.fn();
const getClusterStatsMock = vi.fn();
const getNodesMock = vi.fn();
const getNodeStatsMock = vi.fn();
const getDataStreamsMock = vi.fn();
const resolveIndexMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getClusterInfo: getClusterInfoMock,
    getClusterHealth: getClusterHealthMock,
    getClusterStats: getClusterStatsMock,
    getNodes: getNodesMock,
    getNodeStats: getNodeStatsMock,
    getDataStreams: getDataStreamsMock,
    resolveIndex: resolveIndexMock,
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

describe("ClusterOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDashboardStore.getState().resetState();
    useDashboardStore
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
  });

  it("renders cluster info after loading", async () => {
    render(<ClusterOverviewPage />);

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
    expect(screen.getByText("1")).toBeInTheDocument(); // alias count
  });

  it("shows error alert on total failure", async () => {
    getClusterInfoMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    getClusterHealthMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    getClusterStatsMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    getNodesMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    getNodeStatsMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    getDataStreamsMock.mockRejectedValue({ status: 401, message: "Unauthorized" });
    resolveIndexMock.mockRejectedValue({ status: 401, message: "Unauthorized" });

    render(<ClusterOverviewPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Unauthorized");
    });
  });

  it("refreshes data when Refresh button is clicked", async () => {
    const user = userEvent.setup();

    render(<ClusterOverviewPage />);

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

    render(<ClusterOverviewPage />);

    await waitFor(() => {
      expect(screen.getByText("test-cluster")).toBeInTheDocument();
    });

    expect(screen.getByText(/partial data loaded/i)).toBeInTheDocument();
    expect(screen.getByText(/cluster stats, nodes, node stats/i)).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(6);
  });
});

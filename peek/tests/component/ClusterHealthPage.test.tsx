import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import ClusterHealthPage from "../../src/components/ClusterHealthPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const getClusterHealthMock = vi.fn();
const getPendingTasksMock = vi.fn();
const getCatAllocationMock = vi.fn();
const getClusterStatsMock = vi.fn();
const getNodeStatsMock = vi.fn();
const getCatShardsMock = vi.fn();
const getRecoveryStatusMock = vi.fn();
const getIlmExplainAllMock = vi.fn();
const getSlmStatsMock = vi.fn();
const getSnapshotStatusMock = vi.fn();
const getClusterSettingsMock = vi.fn();
const getAllocationExplainMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getClusterHealth: getClusterHealthMock,
    getPendingTasks: getPendingTasksMock,
    getCatAllocation: getCatAllocationMock,
    getClusterStats: getClusterStatsMock,
    getNodeStats: getNodeStatsMock,
    getCatShards: getCatShardsMock,
    getRecoveryStatus: getRecoveryStatusMock,
    getIlmExplainAll: getIlmExplainAllMock,
    getSlmStats: getSlmStatsMock,
    getSnapshotStatus: getSnapshotStatusMock,
    getClusterSettings: getClusterSettingsMock,
    getAllocationExplain: getAllocationExplainMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

function renderHealth(defaultTab?: string) {
  return render(
    <MemoryRouter>
      <ClusterHealthPage defaultTab={defaultTab as never} />
    </MemoryRouter>,
  );
}

describe("ClusterHealthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });

    getClusterHealthMock.mockResolvedValue({
      status: "yellow",
      number_of_nodes: 3,
      number_of_data_nodes: 2,
      unassigned_shards: 0,
      active_shards_percent_as_number: 100.0,
    });
    getPendingTasksMock.mockResolvedValue({ tasks: [{}, {}] });
    getCatAllocationMock.mockResolvedValue([{ node: "n1", "disk.percent": "86" }]);
    getClusterStatsMock.mockResolvedValue({ indices: { count: 12 } });
    getNodeStatsMock.mockResolvedValue({
      nodes: {
        a: {
          name: "node-a",
          os: { cpu: { percent: 50 } },
          jvm: { mem: { heap_used_percent: 60 } },
          thread_pool: { write: { rejected: 5 }, search: { rejected: 3 }, get: { rejected: 0 } },
          breakers: { parent: { tripped: 1 } },
        },
        b: {
          name: "node-b",
          os: { cpu: { percent: 30 } },
          jvm: { mem: { heap_used_percent: 40 } },
          thread_pool: { write: { rejected: 0 }, search: { rejected: 0 }, get: { rejected: 0 } },
          breakers: {},
        },
      },
    });
    getCatShardsMock.mockResolvedValue([
      { node: "a", state: "STARTED", prirep: "p" },
      { node: "a", state: "STARTED", prirep: "r" },
      { node: "b", state: "STARTED", prirep: "p" },
    ]);
    getRecoveryStatusMock.mockResolvedValue({ "idx-a": { shards: [{ stage: "index" }] } });
    getIlmExplainAllMock.mockResolvedValue({ indices: { "idx-a": { failed_step: "error" } } });
    getSlmStatsMock.mockResolvedValue({ policy_stats: [{ snapshots_failed: 2 }] });
    getSnapshotStatusMock.mockResolvedValue({ snapshots: [{ shards_stats: { failed: 1 } }] });
    getClusterSettingsMock.mockResolvedValue({
      persistent: {},
      transient: {},
      defaults: { "cluster.routing.allocation.enable": "all" },
    });
    getAllocationExplainMock.mockRejectedValue(new Error("no unassigned shards"));
  });

  it("renders overview with cluster status and key metrics", async () => {
    renderHealth();

    await waitFor(() => {
      expect(screen.getByText("YELLOW")).toBeInTheDocument();
    });

    // Active shards percentage
    expect(screen.getByText(/100\.0%/)).toBeInTheDocument();

    // Pending tasks count
    expect(
      within(screen.getByRole("group", { name: "Pending tasks" })).getByText("2"),
    ).toBeInTheDocument();

    // Avg CPU (avg of 50 and 30 = 40)
    expect(screen.getByText("40%")).toBeInTheDocument();

    // Thread pool rejections (5 + 3 = 8)
    expect(
      within(screen.getByRole("group", { name: "Thread pool rejections" })).getByText("8"),
    ).toBeInTheDocument();

    // Circuit breaker trips (1)
    expect(
      within(screen.getByRole("group", { name: "Circuit breaker trips" })).getByText("1"),
    ).toBeInTheDocument();
  });

  it("shows allocation disabled warning when settings indicate", async () => {
    getClusterSettingsMock.mockResolvedValue({
      persistent: {},
      transient: { "cluster.routing.allocation.enable": "none" },
      defaults: {},
    });

    renderHealth();

    await waitFor(() => {
      expect(screen.getByText("YELLOW")).toBeInTheDocument();
    });

    expect(screen.getByText(/Shard allocation is disabled/)).toBeInTheDocument();
  });

  it("calls allocation explain when unassigned shards > 0", async () => {
    getClusterHealthMock.mockResolvedValue({
      status: "red",
      unassigned_shards: 5,
      active_shards_percent_as_number: 80.0,
    });
    getAllocationExplainMock.mockResolvedValue({
      index: "my-index",
      shard: 2,
      primary: true,
      unassigned_info: { reason: "NODE_LEFT" },
      allocate_explanation: "cannot allocate because all nodes are full",
    });

    renderHealth();

    await waitFor(() => {
      expect(getAllocationExplainMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText("Allocation Explain")).toBeInTheDocument();
    });
    expect(screen.getByText(/NODE_LEFT/)).toBeInTheDocument();
  });

  it("does not call allocation explain when 0 unassigned shards", async () => {
    renderHealth();

    await waitFor(() => {
      expect(screen.getByText("YELLOW")).toBeInTheDocument();
    });

    expect(getAllocationExplainMock).not.toHaveBeenCalled();
  });

  it("switches to Nodes tab and shows per-node table", async () => {
    const user = userEvent.setup();
    renderHealth();

    await waitFor(() => {
      expect(screen.getByText("YELLOW")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /nodes/i }));

    await waitFor(() => {
      expect(screen.getByText("node-a")).toBeInTheDocument();
    });
    expect(screen.getByText("node-b")).toBeInTheDocument();
  });

  it("refreshes when Refresh is clicked", async () => {
    const user = userEvent.setup();
    renderHealth();

    await waitFor(() => {
      expect(getClusterHealthMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(getClusterHealthMock).toHaveBeenCalledTimes(2);
    });
  });

  it("handles partial API failures gracefully", async () => {
    getNodeStatsMock.mockRejectedValue(new Error("timeout"));
    getSlmStatsMock.mockRejectedValue(new Error("forbidden"));

    renderHealth();

    await waitFor(() => {
      expect(screen.getByText("YELLOW")).toBeInTheDocument();
    });

    expect(screen.getByText(/Partial data loaded/)).toBeInTheDocument();
    expect(screen.getByText(/node stats/)).toBeInTheDocument();
  });
});

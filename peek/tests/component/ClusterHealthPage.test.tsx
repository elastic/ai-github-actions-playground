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
const getTasksDetailedMock = vi.fn();
const getIlmPoliciesMock = vi.fn();

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
    getTasksDetailed: getTasksDetailedMock,
    getIlmPolicies: getIlmPoliciesMock,
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
    getTasksDetailedMock.mockResolvedValue({ nodes: {} });
    getIlmPoliciesMock.mockResolvedValue({});
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

    let initialCalls = 0;
    await waitFor(() => {
      initialCalls = getClusterHealthMock.mock.calls.length;
      expect(initialCalls).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(getClusterHealthMock.mock.calls.length).toBe(initialCalls + 1);
    });
  });

  it("shows empty state on Tasks tab when there are no pending tasks", async () => {
    getPendingTasksMock.mockResolvedValue({ tasks: [] });
    const user = userEvent.setup();
    renderHealth();

    await waitFor(() => {
      expect(screen.getByText("YELLOW")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /tasks/i }));

    await waitFor(() => {
      expect(screen.getByText("No pending tasks")).toBeInTheDocument();
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

  it("formats disk usage as human-readable sizes on Capacity tab", async () => {
    getCatAllocationMock.mockResolvedValue([
      {
        node: "n1",
        "disk.used": "66550173696",
        "disk.avail": "88344014848",
        "disk.percent": "43",
      },
    ]);

    renderHealth("capacityPressure");

    await waitFor(() => {
      expect(screen.getByText("n1")).toBeInTheDocument();
    });

    const table = screen.getByRole("table", { name: "Node Disk Usage" });
    expect(within(table).getByText("62 GB")).toBeInTheDocument();
    expect(within(table).getByText("82 GB")).toBeInTheDocument();
  });

  it("shows shard distribution by node on Shards tab", async () => {
    getCatShardsMock.mockResolvedValue([
      { index: "idx-a", node: "node-x", state: "STARTED", prirep: "p" },
      { index: "idx-a", node: "node-x", state: "STARTED", prirep: "r" },
      { index: "idx-a", node: "node-x", state: "STARTED", prirep: "x" },
      { index: "idx-b", node: "node-y", state: "STARTED", prirep: "p" },
    ]);

    renderHealth("shardDistribution");

    await waitFor(() => {
      expect(screen.getByText("Shard Distribution by Node")).toBeInTheDocument();
    });

    const nodeTable = screen.getByRole("table", { name: "Shard Distribution by Node" });
    expect(within(nodeTable).getByText("node-x")).toBeInTheDocument();
    expect(within(nodeTable).getByText("node-y")).toBeInTheDocument();
    const nodeXRow = within(nodeTable)
      .getAllByRole("row")
      .find((row) => within(row).queryByText("node-x"));
    expect(nodeXRow).toBeDefined();
    const nodeXCells = within(nodeXRow as HTMLTableRowElement)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
    expect(nodeXCells).toEqual(["node-x", "1", "1", "3"]);
  });
});

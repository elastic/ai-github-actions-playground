import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import ClusterHealthPage from "../../src/components/ClusterHealthPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

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
const getNodeIngestStatsMock = vi.fn();

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
    getNodeIngestStats: getNodeIngestStatsMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

describe("ClusterHealthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });

    getClusterHealthMock.mockResolvedValue({ status: "yellow" });
    getPendingTasksMock.mockResolvedValue({ tasks: [{}, {}] });
    getCatAllocationMock.mockResolvedValue([{ node: "n1", "disk.percent": "86" }]);
    getClusterStatsMock.mockResolvedValue({ indices: { count: 12 } });
    getNodeStatsMock.mockResolvedValue({
      nodes: {
        a: { os: { cpu: { percent: 50 } }, jvm: { mem: { heap_used_percent: 60 } } },
        b: { os: { cpu: { percent: 30 } }, jvm: { mem: { heap_used_percent: 40 } } },
      },
    });
    getCatShardsMock.mockResolvedValue([{ node: "a" }, { node: "a" }, { node: "b" }]);
    getRecoveryStatusMock.mockResolvedValue({ "idx-a": [{ stage: "index" }] });
    getIlmExplainAllMock.mockResolvedValue({ indices: { "idx-a": { failed_step: "error" } } });
    getSlmStatsMock.mockResolvedValue({ policy_stats: [{ snapshots_failed: 2 }] });
    getSnapshotStatusMock.mockResolvedValue({ snapshots: [{ shards_stats: { failed: 1 } }] });
    getNodeIngestStatsMock.mockResolvedValue({
      nodes: { a: { ingest: { total: { failed: 3 } } } },
    });
  });

  it("renders phase 1-3 cards from API data", async () => {
    render(
      <MemoryRouter>
        <ClusterHealthPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Phase 1 — Real-time health")).toBeInTheDocument();
    });

    expect(screen.getByText("Cluster status")).toBeInTheDocument();
    expect(screen.getByText("YELLOW")).toBeInTheDocument();
    expect(screen.getByText("Pending tasks")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText("Avg CPU")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("Ingest failures")).toBeInTheDocument();
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("refreshes when Refresh is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ClusterHealthPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getClusterHealthMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(getClusterHealthMock).toHaveBeenCalledTimes(2);
    });
  });
});

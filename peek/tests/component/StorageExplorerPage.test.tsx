import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import StorageExplorerPage from "../../src/components/StorageExplorerPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const { getCatShardsMock, getNodeStatsMock, getDataStreamsMock } = vi.hoisted(() => ({
  getCatShardsMock: vi.fn(),
  getNodeStatsMock: vi.fn(),
  getDataStreamsMock: vi.fn(),
}));

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getCatShards: getCatShardsMock,
    getNodeStats: getNodeStatsMock,
    getDataStreams: getDataStreamsMock,
  })),
  isElasticsearchError: (error: unknown) => {
    if (typeof error !== "object" || error === null) return false;
    const obj = error as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

async function expandMetricsTree(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 8; i++) {
    const expandButtons = screen.queryAllByRole("button", { name: /^expand /i });
    if (expandButtons.length === 0) break;
    await user.click(expandButtons[0]!);
  }
}

async function selectInstanceGrouping(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /^group by instance$/i }));
}

function setupHappyPathMocks() {
  getDataStreamsMock.mockResolvedValue({
    data_streams: [
      {
        name: "metrics-elastic_agent.default-default",
        status: "GREEN",
        generation: 1,
        template: "metrics",
        indices: [{ index_name: ".ds-metrics-elastic_agent.default-default-000001" }],
      },
    ],
  });
  getNodeStatsMock.mockResolvedValue({
    nodes: {
      "node-a-id": {
        name: "node-a",
        fs: {
          total: {
            total_in_bytes: 1_000_000,
            available_in_bytes: 700_000,
          },
        },
      },
    },
  });
  getCatShardsMock.mockResolvedValue([
    {
      index: ".ds-metrics-elastic_agent.default-default-000001",
      shard: "0",
      prirep: "p",
      state: "STARTED",
      docs: "100",
      store: "1200",
      node: "node-a",
    },
    {
      index: ".ds-metrics-elastic_agent.default-default-000001",
      shard: "0",
      prirep: "r",
      state: "STARTED",
      docs: "100",
      store: "1200",
      node: "node-a",
    },
    {
      index: ".security-7",
      shard: "1",
      prirep: "p",
      state: "STARTED",
      docs: "12",
      store: "256",
      node: "node-a",
    },
  ]);
}

describe("StorageExplorerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
    setupHappyPathMocks();
  });

  it("renders node->signal->dataset hierarchy and shard rows", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <StorageExplorerPage />
      </MemoryRouter>,
    );

    await selectInstanceGrouping(user);
    expect((await screen.findAllByText("node-a")).length).toBeGreaterThan(0);
    expect(screen.getByText("metrics")).toBeInTheDocument();
    expect(screen.getByText("elastic_agent.default")).toBeInTheDocument();

    await expandMetricsTree(user);

    expect(await screen.findByText("shard 0 (primary)")).toBeInTheDocument();
    expect(await screen.findByText("shard 0 (replica)")).toBeInTheDocument();
  });

  it("hides replica shard rows when replica toggle is turned off", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <StorageExplorerPage />
      </MemoryRouter>,
    );

    await selectInstanceGrouping(user);
    await screen.findByText("elastic_agent.default");
    await expandMetricsTree(user);
    expect(await screen.findByText("shard 0 (replica)")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /show replica shard copies/i }));

    expect(screen.queryByText("shard 0 (replica)")).not.toBeInTheDocument();
    expect(screen.getByText("shard 0 (primary)")).toBeInTheDocument();
  });

  it("hides system indices by default and shows them when toggled", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <StorageExplorerPage />
      </MemoryRouter>,
    );

    await selectInstanceGrouping(user);
    expect((await screen.findAllByText("node-a")).length).toBeGreaterThan(0);
    expect(screen.getByTestId("storage-shard-copies")).toHaveTextContent("2");

    await user.click(screen.getByRole("checkbox", { name: /show system indices/i }));
    await waitFor(() => {
      expect(screen.getByTestId("storage-shard-copies")).toHaveTextContent("3");
    });
  });

  it("keeps backing shards visible when data stream metadata is partially unavailable", async () => {
    const user = userEvent.setup();
    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        {
          name: "metrics-elastic_agent.default-default",
          status: "GREEN",
          generation: 1,
          template: "metrics",
        },
      ],
    });

    render(
      <MemoryRouter>
        <StorageExplorerPage />
      </MemoryRouter>,
    );

    await selectInstanceGrouping(user);
    expect(await screen.findByTestId("storage-shard-copies")).toHaveTextContent("2");
    expect(screen.queryByText(".security-7")).not.toBeInTheDocument();
  });

  it("opens and closes a details flyout when selecting a row", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <StorageExplorerPage />
      </MemoryRouter>,
    );

    await selectInstanceGrouping(user);
    await screen.findByText("elastic_agent.default");
    await user.click(screen.getByText("elastic_agent.default"));

    expect(await screen.findByText("Storage details")).toBeInTheDocument();
    expect(screen.getByText(/^100$/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close storage details/i }));
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /close storage details/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("supports switching root grouping mode", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <StorageExplorerPage />
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: /^group by instance$/i });
    await user.click(screen.getByRole("button", { name: /group by namespace/i }));

    expect(await screen.findByRole("button", { name: /change view/i })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /storage explorer tree/i })).toBeInTheDocument();
  });

  it("renders a page-level empty state when the cluster has no shards", async () => {
    getCatShardsMock.mockResolvedValue([]);
    getNodeStatsMock.mockResolvedValue({ nodes: {} });
    getDataStreamsMock.mockResolvedValue({ data_streams: [] });

    render(
      <MemoryRouter>
        <StorageExplorerPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /no storage data found/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/how would you like to slice it/i)).not.toBeInTheDocument();
  });

  it("supports selecting rows from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <StorageExplorerPage />
      </MemoryRouter>,
    );

    await selectInstanceGrouping(user);
    const datasetRow = (await screen.findByText("elastic_agent.default")).closest("tr");
    expect(datasetRow).not.toBeNull();
    if (!datasetRow) throw new Error("Expected dataset row to exist");

    datasetRow.focus();
    fireEvent.keyDown(datasetRow, { key: " ", code: "Space" });

    expect(await screen.findByText("Storage details")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close storage details/i }));
    await waitFor(() => {
      expect(screen.queryByText("Storage details")).not.toBeInTheDocument();
    });

    datasetRow.focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Storage details")).toBeInTheDocument();
  });
});

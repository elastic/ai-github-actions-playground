import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import GlobalHealthPage from "../../src/components/GlobalHealthPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const getClusterHealthMock = vi.fn();
const getPendingTasksMock = vi.fn();
const getNodeStatsMock = vi.fn();
const getTasksDetailedMock = vi.fn();
const getIlmExplainAllMock = vi.fn();
const getIlmPoliciesMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getClusterHealth: getClusterHealthMock,
    getPendingTasks: getPendingTasksMock,
    getNodeStats: getNodeStatsMock,
    getTasksDetailed: getTasksDetailedMock,
    getIlmExplainAll: getIlmExplainAllMock,
    getIlmPolicies: getIlmPoliciesMock,
  })),
}));

describe("GlobalHealthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });

    getClusterHealthMock.mockResolvedValue({ status: "red", unassigned_shards: 2 });
    getPendingTasksMock.mockResolvedValue({ tasks: [{}, {}] });
    getNodeStatsMock.mockResolvedValue({ nodes: {} });
    getTasksDetailedMock.mockResolvedValue({ nodes: {} });
    getIlmExplainAllMock.mockResolvedValue({ indices: {} });
    getIlmPoliciesMock.mockResolvedValue({});
  });

  it("renders summary cards and check table", async () => {
    render(
      <MemoryRouter>
        <GlobalHealthPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Global Health" })).toBeInTheDocument();
    });

    expect(screen.getByText(/Critical:/)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Global health checks" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Cluster status red")).toBeInTheDocument();
    });
  });

  it("opens flyover with check details", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <GlobalHealthPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cluster status red")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Cluster status red" }));

    await waitFor(() => {
      expect(screen.getAllByText("Cluster status red").length).toBeGreaterThan(1);
    });
  });
});

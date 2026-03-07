import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import ClusterSettingsPage from "../../src/components/ClusterSettingsPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const { getClusterSettingsMock } = vi.hoisted(() => ({
  getClusterSettingsMock: vi.fn(),
}));

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getClusterSettings: getClusterSettingsMock,
  })),
  isElasticsearchError: (error: unknown) => {
    if (typeof error !== "object" || error === null) return false;
    const obj = error as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

describe("ClusterSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("renders flattened cluster settings across sources", async () => {
    getClusterSettingsMock.mockResolvedValue({
      transient: {
        "indices.recovery.max_bytes_per_sec": "200mb",
      },
      persistent: {
        "cluster.routing.allocation.enable": "all",
      },
      defaults: {
        "cluster.max_shards_per_node": "1000",
      },
    });

    render(
      <MemoryRouter>
        <ClusterSettingsPage />
      </MemoryRouter>,
    );

    await screen.findByText("cluster.routing.allocation.enable");
    expect(screen.getByText("indices.recovery.max_bytes_per_sec")).toBeInTheDocument();
    expect(screen.queryByText("cluster.max_shards_per_node")).not.toBeInTheDocument();
    expect(screen.getByText("Transient 1")).toBeInTheDocument();
    expect(screen.getByText("Persistent 1")).toBeInTheDocument();
    expect(screen.getByText("Defaults 1")).toBeInTheDocument();
  });

  it("shows default settings only when toggle is enabled", async () => {
    const user = userEvent.setup();
    getClusterSettingsMock.mockResolvedValue({
      transient: {},
      persistent: {
        "cluster.routing.allocation.enable": "all",
      },
      defaults: {
        "cluster.max_shards_per_node": "1000",
      },
    });

    render(
      <MemoryRouter>
        <ClusterSettingsPage />
      </MemoryRouter>,
    );

    await screen.findByText("cluster.routing.allocation.enable");
    expect(screen.queryByText("cluster.max_shards_per_node")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /show defaults/i }));
    expect(screen.getByText("cluster.max_shards_per_node")).toBeInTheDocument();
  });

  it("filters settings by search term", async () => {
    const user = userEvent.setup();
    getClusterSettingsMock.mockResolvedValue({
      transient: {},
      persistent: {
        "cluster.routing.allocation.enable": "all",
        "indices.recovery.max_bytes_per_sec": "40mb",
      },
      defaults: {},
    });

    render(
      <MemoryRouter>
        <ClusterSettingsPage />
      </MemoryRouter>,
    );

    await screen.findByText("cluster.routing.allocation.enable");
    await user.type(screen.getByLabelText(/filter settings by key or value/i), "allocation");

    await waitFor(() => {
      expect(screen.getByText("cluster.routing.allocation.enable")).toBeInTheDocument();
      expect(screen.queryByText("indices.recovery.max_bytes_per_sec")).not.toBeInTheDocument();
    });
  });
});

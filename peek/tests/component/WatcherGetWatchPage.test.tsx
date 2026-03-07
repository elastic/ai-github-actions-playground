import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import WatcherGetWatchPage from "../../src/components/WatcherGetWatchPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const { getWatcherWatchMock, queryWatcherWatchesMock } = vi.hoisted(() => ({
  getWatcherWatchMock: vi.fn(),
  queryWatcherWatchesMock: vi.fn(),
}));

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getWatcherWatch: getWatcherWatchMock,
    queryWatcherWatches: queryWatcherWatchesMock,
  })),
  isElasticsearchError: (error: unknown) => {
    if (typeof error !== "object" || error === null) return false;
    const obj = error as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

describe("WatcherGetWatchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryWatcherWatchesMock.mockResolvedValue({ count: 0, watches: [] });
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("loads and renders watch output when a table row is clicked", async () => {
    const user = userEvent.setup();
    queryWatcherWatchesMock.mockResolvedValue({
      count: 1,
      watches: [
        { _id: "my_watch", status: { state: { active: true }, execution_state: "executed" } },
      ],
    });
    getWatcherWatchMock.mockResolvedValue({
      found: true,
      _id: "my_watch",
      status: { state: { active: true }, execution_state: "executed" },
      watch: { trigger: { schedule: { interval: "1m" } } },
    });

    render(
      <MemoryRouter>
        <WatcherGetWatchPage />
      </MemoryRouter>,
    );

    await user.click(await screen.findByLabelText(/open watch my_watch/i));

    await screen.findByText(/"my_watch"/i);
    expect(screen.getByTestId("watcher-get-watch-output")).toBeInTheDocument();
    expect(screen.getByText("Found yes")).toBeInTheDocument();
    expect(getWatcherWatchMock).toHaveBeenCalledWith("my_watch");
  });

  it("shows not-found error in flyout when selected watch id does not exist", async () => {
    const user = userEvent.setup();
    queryWatcherWatchesMock.mockResolvedValue({
      count: 1,
      watches: [{ _id: "missing_watch", status: { execution_state: "executed" } }],
    });
    getWatcherWatchMock.mockRejectedValue({ status: 404, message: "not_found" });

    render(
      <MemoryRouter>
        <WatcherGetWatchPage />
      </MemoryRouter>,
    );

    await user.click(await screen.findByLabelText(/open watch missing_watch/i));
    expect(await screen.findByRole("alert")).toHaveTextContent('Watch "missing_watch" not found.');
  });

  it("renders watch table with richer columns", async () => {
    const user = userEvent.setup();
    queryWatcherWatchesMock.mockResolvedValue({
      count: 2,
      watches: [
        { _id: "z_watch", status: { execution_state: "executed" } },
        { _id: "a_watch", status: { execution_state: "awaits_execution" } },
      ],
    });
    getWatcherWatchMock.mockResolvedValue({
      found: true,
      _id: "a_watch",
      status: { state: { active: true }, execution_state: "awaits_execution" },
      watch: { metadata: { owner: "ops" } },
    });

    render(
      <MemoryRouter>
        <WatcherGetWatchPage />
      </MemoryRouter>,
    );

    await screen.findByRole("columnheader", { name: /watch id/i });
    await screen.findByRole("columnheader", { name: /active/i });
    await screen.findByRole("columnheader", { name: /^state$/i });
    await screen.findByRole("columnheader", { name: /trigger/i });
    await screen.findByRole("columnheader", { name: /ack/i });
    await screen.findByRole("columnheader", { name: /owner/i });
    await screen.findByRole("columnheader", { name: /last checked/i });
    await screen.findByRole("columnheader", { name: /actions/i });

    await user.click(await screen.findByLabelText(/open watch a_watch/i));

    await screen.findByText(/"a_watch"/i);
    await screen.findByText("Overview");
    await screen.findByText("Raw JSON");
    await screen.findByText("Condition");
    await screen.findByText("Metadata");
    expect(screen.getAllByText("Actions").length).toBeGreaterThan(0);
    expect(getWatcherWatchMock).toHaveBeenCalledWith("a_watch");
  });

  it("filters and sorts watcher rows from the table controls", async () => {
    const user = userEvent.setup();
    queryWatcherWatchesMock.mockResolvedValue({
      count: 3,
      watches: [
        { _id: "gamma_watch", status: { state: { active: false }, execution_state: "executed" } },
        { _id: "alpha_watch", status: { state: { active: true }, execution_state: "executed" } },
        {
          _id: "beta_watch",
          status: { state: { active: false }, execution_state: "awaits_execution" },
        },
      ],
    });

    render(
      <MemoryRouter>
        <WatcherGetWatchPage />
      </MemoryRouter>,
    );

    await screen.findByLabelText(/search watches/i);
    expect(screen.getAllByLabelText(/open watch/i).length).toBe(3);

    await user.type(screen.getByLabelText(/search watches/i), "beta");
    expect(screen.getAllByLabelText(/open watch/i).length).toBe(1);
    expect(screen.getByLabelText(/open watch beta_watch/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/search watches/i));
    await user.click(screen.getByRole("button", { name: /watch id/i }));
    const rows = screen.getAllByLabelText(/open watch/i);
    expect(rows[0]).toHaveAttribute("aria-label", "Open watch gamma_watch");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import WatcherGetWatchPage from "../../src/components/WatcherGetWatchPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const { getWatcherWatchMock } = vi.hoisted(() => ({
  getWatcherWatchMock: vi.fn(),
}));

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getWatcherWatch: getWatcherWatchMock,
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
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("loads and renders watch output by id", async () => {
    const user = userEvent.setup();
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

    await user.type(screen.getByLabelText(/watcher watch id/i), "my_watch");
    await user.click(screen.getByRole("button", { name: /get watch/i }));

    await screen.findByText(/"my_watch"/i);
    expect(screen.getByTestId("watcher-get-watch-output")).toBeInTheDocument();
    expect(screen.getByText("Found yes")).toBeInTheDocument();
    expect(getWatcherWatchMock).toHaveBeenCalledWith("my_watch");
  });

  it("shows not-found error when watch id does not exist", async () => {
    const user = userEvent.setup();
    getWatcherWatchMock.mockRejectedValue({ status: 404, message: "not_found" });

    render(
      <MemoryRouter>
        <WatcherGetWatchPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/watcher watch id/i), "missing_watch");
    await user.click(screen.getByRole("button", { name: /get watch/i }));

    await screen.findByText(/Watch "missing_watch" not found\./i);
  });
});

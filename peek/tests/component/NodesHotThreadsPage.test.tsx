import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import NodesHotThreadsPage from "../../src/components/NodesHotThreadsPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const { getNodesHotThreadsMock } = vi.hoisted(() => ({
  getNodesHotThreadsMock: vi.fn(),
}));

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getNodesHotThreads: getNodesHotThreadsMock,
  })),
}));

describe("NodesHotThreadsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("renders hot threads plain-text output", async () => {
    getNodesHotThreadsMock.mockResolvedValue(
      [
        "::: {node-a}{id}",
        "  100.0% (500ms out of 500ms) cpu usage by thread 'elasticsearch[node-a][search][T#1]'",
        "    10/10 snapshots sharing following 1 elements",
        "      org.elasticsearch.search.SearchService.executeQueryPhase(SearchService.java:123)",
      ].join("\n"),
    );

    render(
      <MemoryRouter>
        <NodesHotThreadsPage />
      </MemoryRouter>,
    );

    await screen.findByRole("table", { name: /parsed hot threads table/i });
    expect(screen.getByText("elasticsearch[node-a][search][T#1]")).toBeInTheDocument();
    await userEvent.click(
      screen.getByLabelText(/open parsed thread elasticsearch\[node-a\]\[search\]\[t#1\]/i),
    );
    expect(screen.getByRole("heading", { name: /thread details/i })).toBeInTheDocument();
    expect(
      screen.getAllByText(/org\.elasticsearch\.search\.SearchService\.executeQueryPhase/i).length,
    ).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /close thread details/i }));
    await userEvent.click(screen.getByRole("tab", { name: /raw hot threads tab/i }));
    expect(screen.getByTestId("nodes-hot-threads-output")).toBeInTheDocument();
    expect(getNodesHotThreadsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "cpu",
        sort: "cpu",
        threads: 3,
        snapshots: 10,
        ignoreIdleThreads: true,
      }),
    );
  });

  it("updates query params when controls change", async () => {
    const user = userEvent.setup();
    getNodesHotThreadsMock
      .mockResolvedValueOnce(
        "::: {node-init}{id}\n  10.0% (50ms out of 500ms) cpu usage by thread 'init-thread'\n  foo.bar.Baz",
      )
      .mockResolvedValue("updated");

    render(
      <MemoryRouter>
        <NodesHotThreadsPage />
      </MemoryRouter>,
    );

    await screen.findByText("init-thread");
    await user.clear(screen.getByLabelText(/node id for hot threads/i));
    await user.type(screen.getByLabelText(/node id for hot threads/i), "node-a");
    await user.click(screen.getByRole("button", { name: /refresh/i }));

    expect(getNodesHotThreadsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodeId: "node-a",
      }),
    );
  });

  it("does not send sort for non-cpu sample types", async () => {
    const user = userEvent.setup();
    getNodesHotThreadsMock
      .mockResolvedValueOnce(
        "::: {node-init}{id}\n  10.0% (50ms out of 500ms) cpu usage by thread 'init-thread'\n  foo.bar.Baz",
      )
      .mockResolvedValue("updated");

    render(
      <MemoryRouter>
        <NodesHotThreadsPage />
      </MemoryRouter>,
    );

    await screen.findByText("init-thread");
    await user.click(screen.getByRole("combobox", { name: /hot threads sample type/i }));
    await user.click(screen.getByRole("option", { name: /memory allocation/i }));
    await user.click(screen.getByRole("button", { name: /refresh/i }));

    expect(getNodesHotThreadsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "mem",
      }),
    );
    const lastCallArg = getNodesHotThreadsMock.mock.calls.at(-1)?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(lastCallArg?.sort).toBeUndefined();
  });

  it("supports grouped parsed view by thread name", async () => {
    const user = userEvent.setup();
    getNodesHotThreadsMock.mockResolvedValue(
      [
        "::: {node-a}{id-a}",
        "  20.0% (100ms out of 500ms) cpu usage by thread 'shared-thread'",
        "    10/10 snapshots sharing following 1 elements",
        "      org.example.Foo.run(Foo.java:1)",
        "::: {node-b}{id-b}",
        "  10.0% (50ms out of 500ms) cpu usage by thread 'shared-thread'",
        "    10/10 snapshots sharing following 1 elements",
        "      org.example.Foo.run(Foo.java:1)",
      ].join("\n"),
    );

    render(
      <MemoryRouter>
        <NodesHotThreadsPage />
      </MemoryRouter>,
    );

    await screen.findByRole("table", { name: /parsed hot threads table/i });
    await user.click(
      screen.getByRole("checkbox", { name: /group parsed hot threads by thread name/i }),
    );

    const groupedTable = await screen.findByRole("table", { name: /grouped hot threads table/i });
    const row = within(groupedTable).getByText("shared-thread").closest("tr");
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent("2");
    expect(row).toHaveTextContent("15.0%");
  });

  it("hides parsed rows that round to 0.0%", async () => {
    getNodesHotThreadsMock.mockResolvedValue(
      [
        "::: {node-a}{id-a}",
        "  0.04% (0.2ms out of 500ms) cpu usage by thread 'tiny-thread'",
        "    10/10 snapshots sharing following 1 elements",
        "      org.example.Tiny.run(Tiny.java:1)",
        "  1.2% (6ms out of 500ms) cpu usage by thread 'hot-thread'",
        "    10/10 snapshots sharing following 1 elements",
        "      org.example.Hot.run(Hot.java:1)",
      ].join("\n"),
    );

    render(
      <MemoryRouter>
        <NodesHotThreadsPage />
      </MemoryRouter>,
    );

    await screen.findByRole("table", { name: /parsed hot threads table/i });
    expect(screen.queryByText("tiny-thread")).not.toBeInTheDocument();
    expect(screen.getByText("hot-thread")).toBeInTheDocument();
  });

  it("shows no-samples message when headers exist but no thread entries are returned", async () => {
    getNodesHotThreadsMock.mockResolvedValue(
      [
        "::: {instance-0000000001}{DxGGHr7iRyKn-YSDrkWQzA}",
        "   Hot threads at 2026-03-07T04:05:48.297Z, interval=500ms, busiestThreads=3, ignoreIdleThreads=true:",
      ].join("\n"),
    );

    render(
      <MemoryRouter>
        <NodesHotThreadsPage />
      </MemoryRouter>,
    );

    await screen.findByText(/no thread samples were returned for this snapshot/i);
  });
});

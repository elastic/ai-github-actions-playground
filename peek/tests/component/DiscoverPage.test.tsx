import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import DiscoverPage from "../../src/components/DiscoverPage";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

const queryMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    query: queryMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value }: { value: string }) => <div data-testid="codemirror-mock">{value}</div>,
}));
vi.mock("@codemirror/lang-sql", () => ({
  sql: () => [],
}));
vi.mock("../../src/components/visualizations/DataTable", () => ({
  default: () => <div data-testid="datatable-mock" />,
}));
vi.mock("../../src/components/QueryPipelineSteps", () => ({
  default: ({
    onRunStep,
  }: {
    onRunStep: (query: string, stepIndex: number) => void;
  }) => (
    <button type="button" onClick={() => onRunStep("FROM step-* | LIMIT 1", 0)}>
      Run step 1
    </button>
  ),
}));

describe("DiscoverPage", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({
      columns: [{ name: "@timestamp", type: "date" }],
      values: [["2025-06-15T12:00:00.000Z"]],
      executionTimeMs: 1,
    });
    useDashboardStore.getState().resetState();
    useDashboardStore
      .getState()
      .setConnection({ url: "https://localhost:9200", apiKey: "test-key" });
    useDashboardStore.getState().setConnected(true);
  });

  it("adds successful queries to history", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /run query/i }));

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));
    expect(useDashboardStore.getState().queryHistory).toEqual([
      "FROM logs-* | SORT @timestamp | LIMIT 50",
    ]);
  });

  it("can select a recent query and run it", async () => {
    const user = userEvent.setup();
    useDashboardStore.getState().appendQueryToHistory("FROM metrics-* | LIMIT 5");
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /recent queries/i }));
    await user.click(screen.getByRole("menuitem", { name: "FROM metrics-* | LIMIT 5" }));
    expect(screen.getByTestId("codemirror-mock")).toHaveTextContent("FROM metrics-* | LIMIT 5");

    await user.click(screen.getByRole("button", { name: /run query/i }));
    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: "FROM metrics-* | LIMIT 5" }),
      expect.any(AbortSignal),
    );
  });

  it("stores the executed step query in history", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DiscoverPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /run step 1/i }));

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: "FROM step-* | LIMIT 1" }),
      expect.any(AbortSignal),
    );
    expect(useDashboardStore.getState().queryHistory[0]).toBe("FROM step-* | LIMIT 1");
  });
});

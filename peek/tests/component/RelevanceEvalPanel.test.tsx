import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RelevanceEvalPanel from "../../src/components/RelevanceEvalPanel";
import { useEvalStore } from "../../src/store/useEvalStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

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

const TEST_CONNECTION = { url: "https://localhost:9200", apiKey: "test-key" };

describe("RelevanceEvalPanel", () => {
  beforeEach(() => {
    queryMock.mockReset();
    resetAllStores();
  });

  it("renders the panel header with collapsed body by default", () => {
    render(<RelevanceEvalPanel connection={TEST_CONNECTION} />);
    expect(screen.getByText("Relevance Evaluation")).toBeInTheDocument();
    expect(screen.queryByText("Judged query set (JSON)")).not.toBeVisible();
  });

  it("expands the panel on header button click", async () => {
    const user = userEvent.setup();
    render(<RelevanceEvalPanel connection={TEST_CONNECTION} />);

    await user.click(screen.getByRole("button", { name: /expand evaluation panel/i }));

    expect(screen.getByText("Judged query set (JSON)")).toBeVisible();
    expect(screen.getByRole("button", { name: /run evaluation/i })).toBeInTheDocument();
  });

  it("disables Run Evaluation when connection is null", async () => {
    const user = userEvent.setup();
    render(<RelevanceEvalPanel connection={null} />);

    await user.click(screen.getByRole("button", { name: /expand evaluation panel/i }));

    expect(screen.getByRole("button", { name: /run evaluation/i })).toBeDisabled();
  });

  it("runs evaluation and shows per-query metrics", async () => {
    const user = userEvent.setup();

    queryMock.mockResolvedValue({
      columns: [{ name: "_id", type: "keyword" }],
      values: [["doc-1"], ["doc-2"], ["doc-3"]],
      executionTimeMs: 10,
    });

    // Set a simple judged set with one query
    useEvalStore
      .getState()
      .setJudgedSetJson(
        JSON.stringify([{ query: "FROM idx | LIMIT 10", relevant: ["doc-1", "doc-3"] }]),
      );

    render(<RelevanceEvalPanel connection={TEST_CONNECTION} />);
    await user.click(screen.getByRole("button", { name: /expand evaluation panel/i }));
    await user.click(screen.getByRole("button", { name: /run evaluation/i }));

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));

    // Results table should appear with the query and metrics
    expect(await screen.findByText("FROM idx | LIMIT 10")).toBeInTheDocument();
    // Recall@10 = 2/2 = 1 → 1.000
    expect(screen.getByText("1.000")).toBeInTheDocument();
  });

  it("shows error in row when a query fails", async () => {
    const user = userEvent.setup();

    queryMock.mockRejectedValue(new Error("connection refused"));

    useEvalStore
      .getState()
      .setJudgedSetJson(JSON.stringify([{ query: "FROM idx | LIMIT 5", relevant: ["doc-1"] }]));

    render(<RelevanceEvalPanel connection={TEST_CONNECTION} />);
    await user.click(screen.getByRole("button", { name: /expand evaluation panel/i }));
    await user.click(screen.getByRole("button", { name: /run evaluation/i }));

    expect(await screen.findByText(/error: connection refused/i)).toBeInTheDocument();
  });

  it("shows average row when there are multiple queries", async () => {
    const user = userEvent.setup();

    queryMock
      .mockResolvedValueOnce({
        columns: [{ name: "_id", type: "keyword" }],
        values: [["doc-1"]],
        executionTimeMs: 5,
      })
      .mockResolvedValueOnce({
        columns: [{ name: "_id", type: "keyword" }],
        values: [["doc-99"]],
        executionTimeMs: 5,
      });

    useEvalStore.getState().setJudgedSetJson(
      JSON.stringify([
        { query: "FROM idx | LIMIT 5", relevant: ["doc-1"] },
        { query: "FROM idx | LIMIT 5", relevant: ["doc-2"] },
      ]),
    );

    render(<RelevanceEvalPanel connection={TEST_CONNECTION} />);
    await user.click(screen.getByRole("button", { name: /expand evaluation panel/i }));
    await user.click(screen.getByRole("button", { name: /run evaluation/i }));

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Average")).toBeInTheDocument();
  });

  it("shows aggregate NDCG chip in the header after a run", async () => {
    const user = userEvent.setup();

    queryMock.mockResolvedValue({
      columns: [{ name: "_id", type: "keyword" }],
      values: [["doc-1"]],
      executionTimeMs: 5,
    });

    useEvalStore
      .getState()
      .setJudgedSetJson(JSON.stringify([{ query: "FROM idx | LIMIT 5", relevant: ["doc-1"] }]));

    render(<RelevanceEvalPanel connection={TEST_CONNECTION} />);
    await user.click(screen.getByRole("button", { name: /expand evaluation panel/i }));
    await user.click(screen.getByRole("button", { name: /run evaluation/i }));

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));

    // NDCG@10 chip should appear in the header
    expect(await screen.findByText(/NDCG@10:/i)).toBeInTheDocument();
  });

  it("shows a parse error when the judged set JSON is invalid", async () => {
    const user = userEvent.setup();

    // Set invalid JSON directly in the store
    useEvalStore.getState().setJudgedSetJson("not-valid-json");

    render(<RelevanceEvalPanel connection={TEST_CONNECTION} />);
    await user.click(screen.getByRole("button", { name: /expand evaluation panel/i }));

    expect(screen.getByText("Invalid JSON")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run evaluation/i })).toBeDisabled();
  });

  it("clears runs when 'Clear runs' button is clicked", async () => {
    const user = userEvent.setup();

    queryMock.mockResolvedValue({
      columns: [{ name: "_id", type: "keyword" }],
      values: [["doc-1"]],
      executionTimeMs: 5,
    });

    useEvalStore
      .getState()
      .setJudgedSetJson(JSON.stringify([{ query: "FROM idx | LIMIT 5", relevant: ["doc-1"] }]));

    render(<RelevanceEvalPanel connection={TEST_CONNECTION} />);
    await user.click(screen.getByRole("button", { name: /expand evaluation panel/i }));
    await user.click(screen.getByRole("button", { name: /run evaluation/i }));

    await waitFor(() => expect(queryMock).toHaveBeenCalledTimes(1));

    await user.click(await screen.findByRole("button", { name: /clear runs/i }));

    expect(useEvalStore.getState().runs).toHaveLength(0);
  });
});

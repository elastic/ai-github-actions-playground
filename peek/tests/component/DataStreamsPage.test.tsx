import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DataStreamsPage from "../../src/components/DataStreamsPage";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

const getDataStreamsMock = vi.fn();
const getFieldCapsMock = vi.fn();

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getDataStreams: getDataStreamsMock,
    getFieldCaps: getFieldCapsMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("DataStreamsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDashboardStore.getState().resetState();
    useDashboardStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("re-selects a valid stream after refresh removes the previous selection", async () => {
    const user = userEvent.setup();

    getDataStreamsMock
      .mockResolvedValueOnce({
        data_streams: [
          { name: "logs-a", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
          { name: "logs-b", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
        ],
      })
      .mockResolvedValueOnce({
        data_streams: [
          { name: "logs-b", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
        ],
      });
    getFieldCapsMock.mockResolvedValue({ fields: {} });

    render(<DataStreamsPage />);

    await screen.findByRole("heading", { level: 6, name: "logs-a" });
    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 6, name: "logs-b" })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /open in query lab/i }));
    expect(useDashboardStore.getState().discoverQueryDraft).toBe(
      "FROM logs-b | SORT @timestamp DESC | LIMIT 50",
    );
    expect(useDashboardStore.getState().currentPage).toBe("discover");
  });

  it("ignores stale field-cap responses when selection changes quickly", async () => {
    const user = userEvent.setup();
    const firstFields = deferred<{ fields: Record<string, Record<string, { type: string }>> }>();
    const secondFields = deferred<{ fields: Record<string, Record<string, { type: string }>> }>();

    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        { name: "logs-a", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
        { name: "logs-b", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
      ],
    });
    getFieldCapsMock
      .mockReturnValueOnce(firstFields.promise)
      .mockReturnValueOnce(secondFields.promise);

    render(<DataStreamsPage />);

    await screen.findByRole("heading", { level: 6, name: "logs-a" });
    await user.click(screen.getByText("logs-b"));

    await act(async () => {
      secondFields.resolve({ fields: { "field-b": { keyword: { type: "keyword" } } } });
    });
    await screen.findByText("field-b");

    await act(async () => {
      firstFields.resolve({ fields: { "field-a": { keyword: { type: "keyword" } } } });
    });

    await waitFor(() => {
      expect(screen.getByText("field-b")).toBeInTheDocument();
      expect(screen.queryByText("field-a")).not.toBeInTheDocument();
    });
  });
});

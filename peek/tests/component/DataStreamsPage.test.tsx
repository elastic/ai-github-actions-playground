import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
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

  it("hides system streams (dot-prefixed) by default", async () => {
    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        {
          name: "logs-a",
          status: "YELLOW",
          generation: 1,
          template: "logs",
          next_generation_managed_by: "Index Lifecycle Management",
          ilm_policy: "logs-hot-warm",
          indices: [{ index_name: ".ds-logs-a-000001" }],
        },
        { name: ".system-stream", status: "GREEN", generation: 1, template: "system", indices: [{}] },
      ],
    });
    getFieldCapsMock.mockResolvedValue({ fields: {} });

    render(<DataStreamsPage />);

    await screen.findAllByText("logs-a");
    const logsRow = screen.getByRole("button", { name: /logs-a/i });
    expect(within(logsRow).getByText("YELLOW - 1 Index")).toBeInTheDocument();
    expect(screen.getByTestId("data-stream-meta-backing-indices")).toHaveTextContent("1");
    expect(screen.getByTestId("data-stream-meta-write-index")).toHaveTextContent(".ds-logs-a-000001");
    expect(screen.getByTestId("data-stream-meta-managed-by")).toHaveTextContent(
      "Index Lifecycle Management",
    );
    expect(screen.getByTestId("data-stream-meta-ilm-policy")).toHaveTextContent("logs-hot-warm");
    expect(screen.queryByText(".system-stream")).not.toBeInTheDocument();
  });

  it("shows system streams when the toggle is enabled", async () => {
    const user = userEvent.setup();

    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        { name: "logs-a", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
        { name: ".system-stream", status: "GREEN", generation: 1, template: "system", indices: [{}] },
      ],
    });
    getFieldCapsMock.mockResolvedValue({ fields: {} });

    render(<DataStreamsPage />);

    await screen.findAllByText("logs-a");
    expect(screen.queryByText(".system-stream")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /show system streams/i }));

    await screen.findByText(".system-stream");
    expect(screen.getByText(".system-stream")).toBeInTheDocument();
  });

  it("does not show a system stream in the details pane when system streams are hidden by default", async () => {
    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        { name: ".system-stream", status: "GREEN", generation: 1, template: "system", indices: [{}] },
        { name: "logs-a", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
      ],
    });
    getFieldCapsMock.mockResolvedValue({ fields: {} });

    render(<DataStreamsPage />);

    // The detail heading should show the first *visible* stream (logs-a), not the hidden one
    await screen.findByRole("heading", { level: 6, name: "logs-a" });
    expect(screen.queryByRole("heading", { level: 6, name: ".system-stream" })).not.toBeInTheDocument();
  });

  it("re-selects first visible stream when hiding system streams after selecting one", async () => {
    const user = userEvent.setup();

    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        { name: "logs-a", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
        { name: ".system-stream", status: "GREEN", generation: 1, template: "system", indices: [{}] },
      ],
    });
    getFieldCapsMock.mockResolvedValue({ fields: {} });

    render(<DataStreamsPage />);

    await screen.findByRole("heading", { level: 6, name: "logs-a" });
    await user.click(screen.getByRole("checkbox", { name: /show system streams/i }));
    await user.click(screen.getByText(".system-stream"));
    await screen.findByRole("heading", { level: 6, name: ".system-stream" });

    await user.click(screen.getByRole("checkbox", { name: /show system streams/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 6, name: "logs-a" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { level: 6, name: ".system-stream" })).not.toBeInTheDocument();
    });
  });

  it("shows empty details and disables open action when only system streams exist and are hidden", async () => {
    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        { name: ".system-a", status: "GREEN", generation: 1, template: "system", indices: [{}] },
        { name: ".system-b", status: "GREEN", generation: 1, template: "system", indices: [{}] },
      ],
    });
    getFieldCapsMock.mockResolvedValue({ fields: {} });

    render(<DataStreamsPage />);

    await screen.findByText("No data streams found.");
    expect(screen.getByText("Select a data stream.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open in query lab/i })).toBeDisabled();
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

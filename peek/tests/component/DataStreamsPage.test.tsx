import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";

import DataStreamsPage from "../../src/components/DataStreamsPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { useQueryStore } from "../../src/store/useQueryStore";
import { useApiConsoleStore } from "../../src/store/useApiConsoleStore";
import { resetAllStores } from "../fixtures/test-utils";

const { getDataStreamsMock, getFieldCapsMock, fetchFieldStatsMock } = vi.hoisted(() => ({
  getDataStreamsMock: vi.fn(),
  getFieldCapsMock: vi.fn(),
  fetchFieldStatsMock: vi.fn(),
}));

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
  fetchFieldStats: fetchFieldStatsMock,
  buildFieldStatsQuery: (index: string, field: string) =>
    `FROM ${index} | STATS total = COUNT(*), non_null = COUNT(\`${field}\`), cardinality = COUNT_DISTINCT(\`${field}\`)`,
  buildTopValuesQuery: (index: string, field: string) =>
    `FROM ${index} | STATS count = COUNT(*) BY \`${field}\` | SORT count DESC | LIMIT 10`,
  buildMinMaxQuery: (index: string, field: string) =>
    `FROM ${index} | STATS min_val = MIN(\`${field}\`), max_val = MAX(\`${field}\`)`,
  isKeywordLikeType: (type: string) =>
    ["keyword", "constant_keyword", "wildcard", "text", "ip", "boolean", "version"].includes(type),
  isNumericOrDateType: (type: string) =>
    [
      "integer",
      "long",
      "short",
      "byte",
      "double",
      "float",
      "half_float",
      "scaled_float",
      "unsigned_long",
      "counter_long",
      "counter_double",
      "counter_integer",
      "aggregate_metric_double",
      "date",
      "date_nanos",
    ].includes(type),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("DataStreamsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
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

    render(
      <MemoryRouter>
        <DataStreamsPage />
        <LocationDisplay />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 6, name: "logs-a" });
    await user.click(screen.getByRole("button", { name: /refresh/i }));

    expect(await screen.findByRole("heading", { level: 6, name: "logs-b" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open in query lab/i }));
    expect(useQueryStore.getState().discoverQueryDraft).toBe(
      "FROM logs-b | SORT @timestamp DESC | LIMIT 50",
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/discover");
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
        {
          name: ".system-stream",
          status: "GREEN",
          generation: 1,
          template: "system",
          indices: [{}],
        },
      ],
    });
    getFieldCapsMock.mockResolvedValue({ fields: {} });

    render(
      <MemoryRouter>
        <DataStreamsPage />
      </MemoryRouter>,
    );

    await screen.findAllByText("logs-a");
    const logsRow = screen.getByRole("button", { name: /logs-a/i });
    expect(within(logsRow).getByText("YELLOW")).toBeInTheDocument();
    expect(within(logsRow).getByText("1 Index")).toBeInTheDocument();
    expect(screen.getByTestId("data-stream-meta-backing-indices")).toHaveTextContent("1");
    expect(screen.getByTestId("data-stream-meta-write-index")).toHaveTextContent(
      ".ds-logs-a-000001",
    );
    expect(screen.getByTestId("data-stream-meta-managed-by")).toHaveTextContent(
      "Index Lifecycle Management",
    );
    expect(screen.getByTestId("data-stream-meta-ilm-policy")).toHaveTextContent("logs-hot-warm");
    expect(screen.queryByText(".system-stream")).not.toBeInTheDocument();
  });

  it("clears the detail panel when search excludes the selected stream", async () => {
    const user = userEvent.setup();

    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        { name: "logs-a", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
      ],
    });
    getFieldCapsMock.mockResolvedValue({ fields: {} });

    render(
      <MemoryRouter>
        <DataStreamsPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 6, name: "logs-a" });

    await user.type(screen.getByRole("textbox", { name: /search streams/i }), "non-existent");

    await waitFor(() => {
      expect(screen.queryByRole("heading", { level: 6, name: "logs-a" })).not.toBeInTheDocument();
      expect(screen.getByText("Select a data stream")).toBeInTheDocument();
    });
  });

  it("truncates long data stream names with a title tooltip", async () => {
    const longName = "metrics-service_destination.1m.otel-default-2026.03.02-000001";
    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        {
          name: longName,
          status: "YELLOW",
          generation: 1,
          template: "logs",
          indices: [{ index_name: `${longName}-000001` }],
        },
      ],
    });
    getFieldCapsMock.mockResolvedValue({ fields: {} });

    render(
      <MemoryRouter>
        <DataStreamsPage />
      </MemoryRouter>,
    );

    const list = await screen.findByRole("list");
    const listLabel = await within(list).findByText(longName);
    expect(listLabel).toHaveAttribute("title", longName);
  });

  it("shows system streams when the toggle is enabled", async () => {
    const user = userEvent.setup();

    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        { name: "logs-a", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
        {
          name: ".system-stream",
          status: "GREEN",
          generation: 1,
          template: "system",
          indices: [{}],
        },
      ],
    });
    getFieldCapsMock.mockResolvedValue({ fields: {} });

    render(
      <MemoryRouter>
        <DataStreamsPage />
      </MemoryRouter>,
    );

    await screen.findAllByText("logs-a");
    expect(screen.queryByText(".system-stream")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /show system streams/i }));

    await screen.findByText(".system-stream");
    expect(screen.getByText(".system-stream")).toBeInTheDocument();
  });

  it("does not show a system stream in the details pane when system streams are hidden by default", async () => {
    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        {
          name: ".system-stream",
          status: "GREEN",
          generation: 1,
          template: "system",
          indices: [{}],
        },
        { name: "logs-a", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
      ],
    });
    getFieldCapsMock.mockResolvedValue({ fields: {} });

    render(
      <MemoryRouter>
        <DataStreamsPage />
      </MemoryRouter>,
    );

    // The detail heading should show the first *visible* stream (logs-a), not the hidden one
    await screen.findByRole("heading", { level: 6, name: "logs-a" });
    expect(
      screen.queryByRole("heading", { level: 6, name: ".system-stream" }),
    ).not.toBeInTheDocument();
  });

  it("re-selects first visible stream when hiding system streams after selecting one", async () => {
    const user = userEvent.setup();

    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        { name: "logs-a", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
        {
          name: ".system-stream",
          status: "GREEN",
          generation: 1,
          template: "system",
          indices: [{}],
        },
      ],
    });
    getFieldCapsMock.mockResolvedValue({ fields: {} });

    render(
      <MemoryRouter>
        <DataStreamsPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 6, name: "logs-a" });
    await user.click(screen.getByRole("checkbox", { name: /show system streams/i }));
    await user.click(screen.getByText(".system-stream"));
    await screen.findByRole("heading", { level: 6, name: ".system-stream" });

    await user.click(screen.getByRole("checkbox", { name: /show system streams/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 6, name: "logs-a" })).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { level: 6, name: ".system-stream" }),
      ).not.toBeInTheDocument();
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

    render(
      <MemoryRouter>
        <DataStreamsPage />
      </MemoryRouter>,
    );

    await screen.findByText("No data streams found");
    expect(screen.getByText("Select a data stream")).toBeInTheDocument();
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

    render(
      <MemoryRouter>
        <DataStreamsPage />
      </MemoryRouter>,
    );

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

  it("opens the Field Stats panel when a field row is clicked", async () => {
    const user = userEvent.setup();

    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        { name: "logs-a", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
      ],
    });
    getFieldCapsMock.mockResolvedValue({
      fields: { "host.name": { keyword: { type: "keyword" } } },
    });
    fetchFieldStatsMock.mockReturnValue(new Promise(() => {})); // keep loading

    render(
      <MemoryRouter>
        <DataStreamsPage />
      </MemoryRouter>,
    );

    // Wait for field list to render
    await screen.findByText("host.name");

    // Click the field row
    await user.click(screen.getByRole("button", { name: /host\.name/i }));

    // Field Stats panel should appear with the field name and a close button
    expect(screen.getAllByText("host.name").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /close field stats/i })).toBeInTheDocument();
  });

  it("closes the Field Stats panel when the close button is clicked", async () => {
    const user = userEvent.setup();

    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        { name: "logs-a", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
      ],
    });
    getFieldCapsMock.mockResolvedValue({
      fields: { "host.name": { keyword: { type: "keyword" } } },
    });
    fetchFieldStatsMock.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <DataStreamsPage />
      </MemoryRouter>,
    );

    await screen.findByText("host.name");
    await user.click(screen.getByRole("button", { name: /host\.name/i }));

    const closeButton = screen.getByRole("button", { name: /close field stats/i });
    await user.click(closeButton);

    expect(screen.queryByRole("button", { name: /close field stats/i })).not.toBeInTheDocument();
  });

  it("clears the Field Stats panel when a different stream is selected", async () => {
    const user = userEvent.setup();

    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        { name: "logs-a", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
        { name: "logs-b", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
      ],
    });
    getFieldCapsMock.mockResolvedValue({
      fields: { "host.name": { keyword: { type: "keyword" } } },
    });
    fetchFieldStatsMock.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <DataStreamsPage />
      </MemoryRouter>,
    );

    await screen.findByText("host.name");
    await user.click(screen.getByRole("button", { name: /host\.name/i }));
    expect(screen.getByRole("button", { name: /close field stats/i })).toBeInTheDocument();

    // Switch to a different stream
    await user.click(screen.getByRole("button", { name: /logs-b/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /close field stats/i })).not.toBeInTheDocument();
    });
  });

  it("navigates to Console with a data stream draft when Inspect in Console is clicked", async () => {
    const user = userEvent.setup();

    getDataStreamsMock.mockResolvedValue({
      data_streams: [
        { name: "logs-a", status: "GREEN", generation: 1, template: "logs", indices: [{}] },
      ],
    });
    getFieldCapsMock.mockResolvedValue({ fields: {} });

    render(
      <MemoryRouter>
        <DataStreamsPage />
        <LocationDisplay />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { level: 6, name: "logs-a" });
    await user.click(screen.getByRole("button", { name: /inspect in console/i }));

    expect(useApiConsoleStore.getState().consoleDraft).toEqual({
      method: "GET",
      path: "/_data_stream/logs-a",
    });
    expect(screen.getByTestId("location")).toHaveTextContent("/console");
  });
});

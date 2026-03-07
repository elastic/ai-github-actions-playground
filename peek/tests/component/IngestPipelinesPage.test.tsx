import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import IngestPipelinesPage from "../../src/components/IngestPipelinesPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const { getIngestPipelinesMock, simulateIngestPipelineMock, getNodeStatsMock } = vi.hoisted(() => ({
  getIngestPipelinesMock: vi.fn(),
  simulateIngestPipelineMock: vi.fn(),
  getNodeStatsMock: vi.fn(),
}));

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getIngestPipelines: getIngestPipelinesMock,
    simulateIngestPipeline: simulateIngestPipelineMock,
    getNodeStats: getNodeStatsMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

const PIPELINES_RESPONSE = {
  "my-pipeline": {
    description: "Parse and enrich logs",
    version: 2,
    processors: [{ set: { field: "env", value: "production" } }],
  },
  "another-pipeline": {
    processors: [{ lowercase: { field: "message" } }, { trim: { field: "message" } }],
  },
};

const INPUT_LABEL = "Input documents (JSON, JSON array, or NDJSON)";

async function selectPipeline(name: string) {
  await userEvent.click(screen.getByLabelText(`Select pipeline ${name}`));
}

describe("IngestPipelinesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNodeStatsMock.mockResolvedValue({ nodes: {} });
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("renders the pipeline list and keeps detail flyout closed by default", async () => {
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText("another-pipeline");
    expect(
      screen.queryByRole("heading", { level: 6, name: "another-pipeline" }),
    ).not.toBeInTheDocument();
    // Both pipelines should appear in the left-panel list
    expect(screen.getAllByText("another-pipeline").length).toBeGreaterThan(0);
    expect(screen.getAllByText("my-pipeline").length).toBeGreaterThan(0);
  });

  it("shows pipeline metadata in the detail panel", async () => {
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    // Select "my-pipeline" (second alphabetically)
    await screen.findByText("my-pipeline");
    await selectPipeline("my-pipeline");

    await screen.findByRole("heading", { level: 6, name: "my-pipeline" });
    expect(screen.getByTestId("pipeline-meta-description")).toHaveTextContent(
      "Parse and enrich logs",
    );
    expect(screen.getByTestId("pipeline-meta-version")).toHaveTextContent("2");
    expect(screen.getByTestId("pipeline-meta-processors")).toHaveTextContent("1");
  });

  it("renders processors in structured fieldset/legend UI", async () => {
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    // Select "my-pipeline" which has a "set" processor
    await screen.findByText("my-pipeline");
    await selectPipeline("my-pipeline");
    await screen.findByRole("heading", { level: 6, name: "my-pipeline" });

    // Verify the processor list exists and contains fieldset/legend structure
    const processorsList = screen.getByTestId("pipeline-processors-list");
    expect(processorsList).toBeInTheDocument();

    // The "set" processor type should appear as a legend
    expect(processorsList).toHaveTextContent("set");
    // The processor config is collapsed by default — expand it
    expect(processorsList).not.toHaveTextContent("production");
    await userEvent.click(screen.getByRole("button", { name: /show config/i }));
    // The processor config should now be visible
    expect(processorsList).toHaveTextContent("production");
  });

  it("filters the pipeline list by search term", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText("my-pipeline");
    await user.type(screen.getByPlaceholderText("Search pipelines"), "my-");

    await waitFor(() => {
      expect(screen.queryByLabelText("Select pipeline another-pipeline")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Select pipeline my-pipeline")).toBeInTheDocument();
    });
  });

  it("shows empty state when no pipelines match the search", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText("my-pipeline");
    await user.type(screen.getByPlaceholderText("Search pipelines"), "does-not-exist");

    await screen.findByText("No pipelines found");
  });

  it("keeps detail flyout closed when search excludes all pipelines", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByLabelText("Select pipeline another-pipeline");

    // Type a search that matches nothing
    await user.type(screen.getByPlaceholderText("Search pipelines"), "does-not-exist");

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { level: 6, name: "another-pipeline" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("No pipelines found")).toBeInTheDocument();
    });
  });

  it("shows error alert when loading fails", async () => {
    getIngestPipelinesMock.mockRejectedValue({ status: 403, message: "permission_denied" });

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText("permission_denied");
  });

  it("shows n/a runtime columns when node stats are unavailable", async () => {
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);
    getNodeStatsMock.mockRejectedValue({ status: 403, message: "forbidden_node_stats" });

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText(/Runtime counters unavailable: forbidden_node_stats/i);
    const pipelineRow = screen.getByLabelText("Select pipeline another-pipeline");
    expect(pipelineRow).toHaveTextContent("n/a");
  });

  it("closes the pipeline detail flyout when close is clicked", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText("another-pipeline");
    await selectPipeline("another-pipeline");
    await screen.findByRole("heading", { level: 6, name: "another-pipeline" });
    await user.click(screen.getByRole("button", { name: /close pipeline details/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { level: 6, name: "another-pipeline" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /close pipeline details/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("runs simulate and displays the structured result with status chips", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);
    simulateIngestPipelineMock.mockResolvedValue({
      docs: [{ doc: { _source: { env: "production" } } }],
    });

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText("my-pipeline");
    await user.click(screen.getByLabelText("Select pipeline my-pipeline"));
    await screen.findByRole("heading", { level: 6, name: "my-pipeline" });

    await user.click(screen.getByRole("button", { name: /simulate/i }));

    const resultContainer = await screen.findByTestId("simulate-result");
    // Shows the OK status chip for the successful doc
    expect(resultContainer).toBeInTheDocument();
    expect(screen.getByTestId("doc-result-status-0")).toHaveTextContent("OK");
    // Expand Doc 1 to see its output
    await user.click(screen.getByRole("button", { name: /expand doc 1/i }));
    await waitFor(() => {
      expect(resultContainer.textContent).toContain("production");
    });
  });

  it("shows Error chip and reason for a failed document", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);
    simulateIngestPipelineMock.mockResolvedValue({
      docs: [
        {
          doc: {
            _source: {},
            error: { type: "grok_exception", reason: "pattern_match_failure" },
          },
        },
      ],
    });

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText("my-pipeline");
    await user.click(screen.getByLabelText("Select pipeline my-pipeline"));
    await user.click(screen.getByRole("button", { name: /simulate/i }));

    await screen.findByTestId("simulate-result");
    expect(screen.getByTestId("doc-result-status-0")).toHaveTextContent("Error");
    expect(screen.getByTestId("simulate-result").textContent).toContain("grok_exception");
    expect(screen.getByTestId("simulate-result").textContent).toContain("pattern_match_failure");
  });

  it("simulates a JSON array of multiple documents", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);
    simulateIngestPipelineMock.mockResolvedValue({
      docs: [{ doc: { _source: { env: "production" } } }, { doc: { _source: { env: "staging" } } }],
    });

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText("my-pipeline");
    await user.click(screen.getByLabelText("Select pipeline my-pipeline"));
    await screen.findByRole("heading", { level: 6, name: "my-pipeline" });

    // Replace input with a JSON array
    const input = screen.getByLabelText(INPUT_LABEL);
    fireEvent.change(input, {
      target: { value: '[{"env": "production"}, {"env": "staging"}]' },
    });

    await user.click(screen.getByRole("button", { name: /simulate/i }));

    const resultContainer = await screen.findByTestId("simulate-result");
    expect(resultContainer).toBeInTheDocument();
    // Should show status chips for both docs
    expect(screen.getByTestId("doc-result-status-0")).toHaveTextContent("OK");
    expect(screen.getByTestId("doc-result-status-1")).toHaveTextContent("OK");
    expect(screen.getByText("Results — 2 documents")).toBeInTheDocument();

    // Verify the API received both docs as an array
    expect(simulateIngestPipelineMock).toHaveBeenCalledWith(
      "my-pipeline",
      [{ _source: { env: "production" } }, { _source: { env: "staging" } }],
      { verbose: false },
    );
  });

  it("simulates NDJSON input (one JSON object per line)", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);
    simulateIngestPipelineMock.mockResolvedValue({
      docs: [{ doc: { _source: { a: 1 } } }, { doc: { _source: { b: 2 } } }],
    });

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText("my-pipeline");
    await user.click(screen.getByLabelText("Select pipeline my-pipeline"));

    const input = screen.getByLabelText(INPUT_LABEL);
    fireEvent.change(input, { target: { value: '{"a": 1}\n{"b": 2}' } });

    await user.click(screen.getByRole("button", { name: /simulate/i }));

    await screen.findByTestId("simulate-result");
    expect(simulateIngestPipelineMock).toHaveBeenCalledWith(
      "my-pipeline",
      [{ _source: { a: 1 } }, { _source: { b: 2 } }],
      { verbose: false },
    );
  });

  it("passes verbose flag to the API when verbose trace is enabled", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);
    simulateIngestPipelineMock.mockResolvedValue({
      docs: [
        {
          doc: { _source: { env: "production" } },
          processor_results: [
            { processor_type: "set", status: "success" },
            { processor_type: "rename", status: "error" },
            { processor_type: "drop", status: "unexpected_status" },
          ],
        },
      ],
    });

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText("my-pipeline");
    await user.click(screen.getByLabelText("Select pipeline my-pipeline"));

    // Enable verbose trace
    await user.click(screen.getByRole("checkbox", { name: /verbose processor trace/i }));
    await user.click(screen.getByRole("button", { name: /simulate/i }));

    await screen.findByTestId("simulate-result");
    expect(simulateIngestPipelineMock).toHaveBeenCalledWith("my-pipeline", expect.any(Array), {
      verbose: true,
    });

    // Expand the doc to see the trace
    await user.click(screen.getByRole("button", { name: /expand doc 1/i }));
    await waitFor(() => {
      expect(screen.getByTestId("simulate-result").textContent).toContain("set");
    });
    expect(screen.getByTestId("processor-trace-status-0-0")).toHaveTextContent("OK");
    expect(screen.getByTestId("processor-trace-status-0-1")).toHaveTextContent("Error");
    expect(screen.getByTestId("processor-trace-status-0-2")).toHaveTextContent("Unknown");
  });

  it("shows a simulate error when the API call fails", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);
    simulateIngestPipelineMock.mockRejectedValue({ status: 400, message: "simulation_failed" });

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText("my-pipeline");
    await user.click(screen.getByLabelText("Select pipeline my-pipeline"));
    await screen.findByRole("heading", { level: 6, name: "my-pipeline" });

    await user.click(screen.getByRole("button", { name: /simulate/i }));

    await screen.findByText("simulation_failed");
  });

  it("shows a validation error when the simulate input is invalid JSON", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText("my-pipeline");
    await user.click(screen.getByLabelText("Select pipeline my-pipeline"));
    await screen.findByRole("heading", { level: 6, name: "my-pipeline" });

    const input = screen.getByLabelText(INPUT_LABEL);
    fireEvent.change(input, { target: { value: "not-valid-json" } });

    await user.click(screen.getByRole("button", { name: /simulate/i }));

    await screen.findByText(/invalid json/i);
  });

  it("renders detailed runtime stats with hot nodes and processor hotspots", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);
    getNodeStatsMock.mockResolvedValue({
      nodes: {
        nodeA: {
          name: "ingest-a",
          ingest: {
            pipelines: {
              "my-pipeline": {
                count: 200,
                failed: 4,
                current: 1,
                time_in_millis: 1000,
                processors: [
                  {
                    "set:set-env": {
                      type: "set",
                      stats: { count: 200, failed: 0, current: 0, time_in_millis: 200 },
                    },
                  },
                  {
                    "grok:parse-message": {
                      type: "grok",
                      stats: { count: 200, failed: 4, current: 1, time_in_millis: 650 },
                    },
                  },
                ],
              },
            },
          },
        },
        nodeB: {
          name: "ingest-b",
          ingest: {
            pipelines: {
              "my-pipeline": {
                count: 100,
                failed: 1,
                current: 0,
                time_in_millis: 700,
                processors: [
                  {
                    "set:set-env": {
                      type: "set",
                      stats: { count: 100, failed: 0, current: 0, time_in_millis: 120 },
                    },
                  },
                  {
                    "grok:parse-message": {
                      type: "grok",
                      stats: { count: 100, failed: 1, current: 0, time_in_millis: 530 },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText("my-pipeline");
    await user.click(screen.getByLabelText("Select pipeline my-pipeline"));
    await screen.findByRole("heading", { level: 6, name: "my-pipeline" });

    const runtimeSection = await screen.findByTestId("pipeline-runtime-stats");
    expect(runtimeSection).toHaveTextContent("Docs processed");
    expect(runtimeSection).toHaveTextContent("300");
    expect(runtimeSection).toHaveTextContent("Failed");
    expect(runtimeSection).toHaveTextContent("5");
    expect(runtimeSection).toHaveTextContent("Hot nodes");
    expect(runtimeSection).toHaveTextContent("ingest-a");
    expect(runtimeSection).toHaveTextContent("Processor hotspots");
    expect(runtimeSection).toHaveTextContent("grok:parse-message");
    expect(screen.getByText("Active pipelines")).toBeInTheDocument();
    expect(screen.getAllByText("Current in-flight").length).toBeGreaterThan(0);
    const activePipelinesCard = screen.getByText("Active pipelines").closest(".MuiPaper-root");
    expect(activePipelinesCard).not.toBeNull();
    expect(within(activePipelinesCard as HTMLElement).getByText("1")).toBeInTheDocument();

    const processorTable = screen.getByRole("table", { name: /pipeline processor runtime stats/i });
    const rows = within(processorTable).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("set:set-env");
    expect(rows[2]).toHaveTextContent("grok:parse-message");
  });

  it("sorts pipelines by Avg ms/doc when the header is clicked", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue({
      "fast-pipeline": { processors: [{ set: { field: "a", value: 1 } }] },
      "slow-pipeline": { processors: [{ set: { field: "b", value: 2 } }] },
    });
    getNodeStatsMock.mockResolvedValue({
      nodes: {
        nodeA: {
          name: "ingest-a",
          ingest: {
            pipelines: {
              "fast-pipeline": { count: 200, failed: 0, current: 0, time_in_millis: 400 },
              "slow-pipeline": { count: 100, failed: 0, current: 0, time_in_millis: 700 },
            },
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByLabelText("Select pipeline fast-pipeline");
    const pipelineTable = screen.getByRole("table", { name: /ingest pipeline list/i });

    // First click switches to avg sort descending (default direction).
    await user.click(screen.getByRole("button", { name: "Avg ms/doc" }));
    let rows = within(pipelineTable).getAllByRole("row");
    expect(rows[1]).toHaveAttribute("aria-label", "Select pipeline slow-pipeline");
    expect(rows[2]).toHaveAttribute("aria-label", "Select pipeline fast-pipeline");

    // Second click toggles ascending.
    await user.click(screen.getByRole("button", { name: "Avg ms/doc" }));
    rows = within(pipelineTable).getAllByRole("row");
    expect(rows[1]).toHaveAttribute("aria-label", "Select pipeline fast-pipeline");
    expect(rows[2]).toHaveAttribute("aria-label", "Select pipeline slow-pipeline");
  });

  it("refreshes pipelines when Refresh button is clicked", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock
      .mockResolvedValueOnce(PIPELINES_RESPONSE)
      .mockResolvedValueOnce({ "new-pipeline": { processors: [] } });

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByLabelText("Select pipeline my-pipeline");
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await screen.findByLabelText("Select pipeline new-pipeline");
    expect(screen.queryByLabelText("Select pipeline my-pipeline")).not.toBeInTheDocument();
  });

  it("clears simulate results when switching to a different pipeline", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);
    simulateIngestPipelineMock.mockResolvedValue({
      docs: [{ doc: { _source: { env: "production" } } }],
    });

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    // Select and simulate on "another-pipeline"
    await screen.findByLabelText("Select pipeline another-pipeline");
    await selectPipeline("another-pipeline");
    await screen.findByRole("heading", { level: 6, name: "another-pipeline" });
    await user.click(screen.getByRole("button", { name: /simulate/i }));
    await screen.findByTestId("simulate-result");

    // Switch to "my-pipeline"
    await user.click(screen.getByLabelText("Select pipeline my-pipeline"));

    await waitFor(() => {
      expect(screen.queryByTestId("simulate-result")).not.toBeInTheDocument();
    });
  });

  it("shows actionable empty state with Add data link when the cluster has no pipelines", async () => {
    getIngestPipelinesMock.mockResolvedValue({});

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    // Wait for the empty state to appear in the detail panel
    await screen.findByText("No ingest pipelines");

    // Add data links should appear
    await waitFor(() => {
      const addDataLinks = screen.getAllByRole("link", { name: /add data/i });
      expect(addDataLinks.length).toBeGreaterThanOrEqual(1);
    });

    // Should NOT show "Select a pipeline" since there are no pipelines
    expect(screen.queryByText("Select a pipeline")).not.toBeInTheDocument();
  });

  it("shows search-specific empty state when pipelines exist but search excludes all", async () => {
    const user = userEvent.setup();
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    await screen.findByText("my-pipeline");
    await user.type(screen.getByPlaceholderText("Search pipelines"), "does-not-exist");

    await screen.findByText("No pipelines found");
    // Should NOT show the "No ingest pipelines" heading or Add data link
    expect(screen.queryByText("No ingest pipelines")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /add data/i })).not.toBeInTheDocument();
  });
});

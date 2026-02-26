import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import IngestPipelinesPage from "../../src/components/IngestPipelinesPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

const { getIngestPipelinesMock, simulateIngestPipelineMock } = vi.hoisted(() => ({
  getIngestPipelinesMock: vi.fn(),
  simulateIngestPipelineMock: vi.fn(),
}));

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getIngestPipelines: getIngestPipelinesMock,
    simulateIngestPipeline: simulateIngestPipelineMock,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

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

describe("IngestPipelinesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("renders the pipeline list sorted alphabetically and selects the first entry", async () => {
    getIngestPipelinesMock.mockResolvedValue(PIPELINES_RESPONSE);

    render(
      <MemoryRouter>
        <IngestPipelinesPage />
      </MemoryRouter>,
    );

    // First alphabetically is "another-pipeline" — shown as heading in the detail panel
    await screen.findByRole("heading", { level: 6, name: "another-pipeline" });
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
    await userEvent.click(screen.getByRole("button", { name: /my-pipeline/i }));

    await screen.findByRole("heading", { level: 6, name: "my-pipeline" });
    expect(screen.getByTestId("pipeline-meta-description")).toHaveTextContent(
      "Parse and enrich logs",
    );
    expect(screen.getByTestId("pipeline-meta-version")).toHaveTextContent("2");
    expect(screen.getByTestId("pipeline-meta-processors")).toHaveTextContent("1");
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
      expect(screen.queryByRole("button", { name: /another-pipeline/i })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /my-pipeline/i })).toBeInTheDocument();
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

    await screen.findByText("No pipelines found.");
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

  it("runs simulate and displays the result", async () => {
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
    await user.click(screen.getByRole("button", { name: /my-pipeline/i }));
    await screen.findByRole("heading", { level: 6, name: "my-pipeline" });

    await user.click(screen.getByRole("button", { name: /simulate/i }));

    await screen.findByTestId("simulate-result");
    expect(screen.getByTestId("simulate-result").textContent).toContain("production");
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
    await user.click(screen.getByRole("button", { name: /my-pipeline/i }));
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
    await user.click(screen.getByRole("button", { name: /my-pipeline/i }));
    await screen.findByRole("heading", { level: 6, name: "my-pipeline" });

    const input = screen.getByLabelText("Input document (JSON)");
    fireEvent.change(input, { target: { value: "not-valid-json" } });

    await user.click(screen.getByRole("button", { name: /simulate/i }));

    await screen.findByText(/invalid json/i);
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

    await screen.findByRole("heading", { level: 6, name: "another-pipeline" });
    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await screen.findByRole("heading", { level: 6, name: "new-pipeline" });
    expect(screen.queryByRole("button", { name: /my-pipeline/i })).not.toBeInTheDocument();
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

    // Select and simulate on "another-pipeline" (first alphabetically)
    await screen.findByRole("heading", { level: 6, name: "another-pipeline" });
    await user.click(screen.getByRole("button", { name: /simulate/i }));
    await screen.findByTestId("simulate-result");

    // Switch to "my-pipeline"
    await user.click(screen.getByRole("button", { name: /my-pipeline/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("simulate-result")).not.toBeInTheDocument();
    });
  });
});

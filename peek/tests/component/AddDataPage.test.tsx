import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AddDataPage, { deriveOtlpEndpoint } from "../../src/components/AddDataPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getClusterInfo: vi.fn().mockResolvedValue({ version: { number: "8.17.0" } }),
    createApiKey: vi.fn().mockResolvedValue({ id: "1", name: "k", encoded: "abc123" }),
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/add-data"]}>
      <Routes>
        <Route path="/add-data" element={<AddDataPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function getCommandValue(): string {
  return (screen.getByLabelText("Starter command") as HTMLTextAreaElement).value;
}

describe("AddDataPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore.getState().setConnection({
      url: "https://my-project.es.us-east-1.aws.elastic.cloud:443",
      apiKey: "testkey",
    });
    useConnectionStore.setState({ capabilities: { canCreateApiKeys: true } as never });
  });

  it("renders the endpoint type toggle with Elasticsearch selected by default", () => {
    renderPage();
    const esButton = screen.getByRole("button", { name: "Elasticsearch" });
    const otlpButton = screen.getByRole("button", { name: "Managed OTLP" });
    expect(esButton).toHaveAttribute("aria-pressed", "true");
    expect(otlpButton).toHaveAttribute("aria-pressed", "false");
  });

  it("shows ES endpoint in the command when Elasticsearch is selected", () => {
    renderPage();
    expect(getCommandValue()).toContain("my-project.es.us-east-1.aws.elastic.cloud");
  });

  it("switches to Managed OTLP and shows OTLP-derived endpoint in the command", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Managed OTLP" }));

    expect(getCommandValue()).toContain("my-project.ingest.us-east-1.aws.elastic.cloud");
  });

  it("shows detected OTLP endpoint alert for Elastic Cloud URLs", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Managed OTLP" }));

    const alerts = screen.getAllByRole("alert");
    const otlpAlert = alerts.find((a) => a.textContent?.includes("Detected Elastic Cloud URL"));
    expect(otlpAlert).toBeDefined();
  });

  it("shows placeholder guidance when OTLP endpoint cannot be derived", async () => {
    resetAllStores();
    useConnectionStore.getState().setConnection({
      url: "http://localhost:9200",
      apiKey: "testkey",
    });
    useConnectionStore.setState({ capabilities: { canCreateApiKeys: true } as never });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Managed OTLP" }));

    expect(screen.getByText(/Enter your managed OTLP endpoint/)).toBeInTheDocument();
    expect(getCommandValue()).toContain("<YOUR_OTLP_ENDPOINT>");
  });

  it("uses OTEL_EXPORTER_OTLP_ENDPOINT env var for Linux when OTLP is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Managed OTLP" }));
    await user.click(screen.getByRole("tab", { name: "Linux" }));

    const value = getCommandValue();
    expect(value).toContain("OTEL_EXPORTER_OTLP_ENDPOINT");
    expect(value).toContain("OTEL_EXPORTER_OTLP_HEADERS");
    expect(value).not.toContain("ELASTIC_ENDPOINT");
  });

  it("uses OTEL_EXPORTER_OTLP_ENDPOINT env var for Docker when OTLP is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Managed OTLP" }));
    await user.click(screen.getByRole("tab", { name: "Docker" }));

    const value = getCommandValue();
    expect(value).toContain("OTEL_EXPORTER_OTLP_ENDPOINT");
    expect(value).toContain("OTEL_EXPORTER_OTLP_HEADERS");
  });

  it("uses OTEL env vars for Windows when OTLP is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Managed OTLP" }));
    await user.click(screen.getByRole("tab", { name: "Windows" }));

    const value = getCommandValue();
    expect(value).toContain("OTEL_EXPORTER_OTLP_ENDPOINT");
    expect(value).toContain("OTEL_EXPORTER_OTLP_HEADERS");
  });

  it("reverts to ES env vars when switching back to Elasticsearch", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Managed OTLP" }));
    await user.click(screen.getByRole("tab", { name: "Linux" }));

    expect(getCommandValue()).toContain("OTEL_EXPORTER_OTLP_ENDPOINT");

    await user.click(screen.getByRole("button", { name: "Elasticsearch" }));

    const value = getCommandValue();
    expect(value).toContain("ELASTIC_ENDPOINT");
    expect(value).toContain("ELASTIC_API_KEY");
  });

  it("shows OTLP comment in Kubernetes command when OTLP is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Managed OTLP" }));

    // Kubernetes is the default tab — command should mention OTLP credentials
    await waitFor(() => {
      expect(getCommandValue()).toContain("OTLP credentials");
    });
  });
});

describe("deriveOtlpEndpoint", () => {
  it("derives OTLP endpoint from Elastic Cloud ES URL", () => {
    // Port 443 is the default HTTPS port and is normalized away by URL
    expect(deriveOtlpEndpoint("https://my-project.es.us-east-1.aws.elastic.cloud:443")).toBe(
      "https://my-project.ingest.us-east-1.aws.elastic.cloud",
    );
  });

  it("handles Elastic Cloud URL without port", () => {
    expect(deriveOtlpEndpoint("https://abc123.es.eu-west-1.aws.elastic.cloud")).toBe(
      "https://abc123.ingest.eu-west-1.aws.elastic.cloud",
    );
  });

  it("preserves non-default port", () => {
    expect(deriveOtlpEndpoint("https://abc123.es.eu-west-1.aws.elastic.cloud:9243")).toBe(
      "https://abc123.ingest.eu-west-1.aws.elastic.cloud:9243",
    );
  });

  it("handles URL with trailing slash", () => {
    expect(deriveOtlpEndpoint("https://abc123.es.eu-west-1.aws.elastic.cloud/")).toBe(
      "https://abc123.ingest.eu-west-1.aws.elastic.cloud",
    );
  });

  it("returns null for non-Elastic Cloud URL", () => {
    expect(deriveOtlpEndpoint("http://localhost:9200")).toBeNull();
  });

  it("returns null for self-managed URL with .es. in hostname but not elastic.cloud", () => {
    expect(deriveOtlpEndpoint("https://my.es.example.com")).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(deriveOtlpEndpoint("not-a-url")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(deriveOtlpEndpoint("")).toBeNull();
  });
});

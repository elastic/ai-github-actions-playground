import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AddDataPage, {
  deriveOtlpEndpoint,
  probeOtlpEndpoint,
} from "../../src/components/AddDataPage";
import type { UserCapabilities } from "../../src/services/es";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getClusterInfo: vi.fn().mockResolvedValue({ version: { number: "8.17.0" } }),
    createApiKey: vi.fn().mockResolvedValue({ id: "1", name: "k", encodedApiKey: "abc123" }),
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

const fetchSpy = vi.spyOn(globalThis, "fetch");

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

const defaultCapabilities: UserCapabilities = {
  canManageDataStreams: false,
  canCreateApiKeys: true,
  canReadSecurityUsers: false,
  canReadSecurityRoles: false,
};

describe("AddDataPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    // Default: probe resolves (ingest endpoint reachable)
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));
    useConnectionStore.getState().setConnection({
      url: "https://my-project.es.us-east-1.aws.elastic.cloud:443",
      apiKey: "testkey",
    });
    useConnectionStore.setState({ capabilities: defaultCapabilities });
  });

  it("renders the endpoint type toggle", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Elasticsearch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Managed OTLP" })).toBeInTheDocument();
  });

  it("auto-selects Managed OTLP when ingest endpoint probe succeeds", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Managed OTLP" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    await user.click(screen.getByRole("tab", { name: "Linux" }));
    expect(getCommandValue()).toContain("my-project.ingest.us-east-1.aws.elastic.cloud");
  });

  it("keeps manual Elasticsearch selection when a successful probe resolves in flight", async () => {
    let resolveProbe: (() => void) | null = null;
    fetchSpy.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProbe = () => resolve(new Response(null, { status: 200 }));
        }),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Managed OTLP" }));
    await user.click(screen.getByRole("button", { name: "Elasticsearch" }));
    resolveProbe?.();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Elasticsearch" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    await user.click(screen.getByRole("tab", { name: "Linux" }));
    expect(getCommandValue()).toContain("my-project.es.us-east-1.aws.elastic.cloud");
  });

  it("shows verified alert when probe succeeds and OTLP is selected", async () => {
    renderPage();
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.some((a) => a.textContent?.includes("OTLP endpoint verified"))).toBe(true);
    });
  });

  it("stays on Elasticsearch when ingest endpoint probe fails", async () => {
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));
    renderPage();
    // Wait for probe to settle
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    // Should remain on Elasticsearch
    expect(screen.getByRole("button", { name: "Elasticsearch" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(getCommandValue()).toContain("my-project.es.us-east-1.aws.elastic.cloud");
  });

  it("shows warning alert when probe fails and user manually selects OTLP", async () => {
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    await user.click(screen.getByRole("button", { name: "Managed OTLP" }));
    const alerts = screen.getAllByRole("alert");
    expect(alerts.some((a) => a.textContent?.includes("Could not reach OTLP endpoint"))).toBe(true);
  });

  it("shows placeholder guidance when OTLP endpoint cannot be derived", async () => {
    resetAllStores();
    useConnectionStore.getState().setConnection({
      url: "http://localhost:9200",
      apiKey: "testkey",
    });
    useConnectionStore.setState({ capabilities: defaultCapabilities });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Managed OTLP" }));
    await user.click(screen.getByRole("tab", { name: "Linux" }));

    expect(screen.getByText(/Enter your managed OTLP endpoint/)).toBeInTheDocument();
    expect(getCommandValue()).toContain("<YOUR_OTLP_ENDPOINT>");
  });

  it("uses OTEL_EXPORTER_OTLP_ENDPOINT env var for Linux when OTLP is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Managed OTLP" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    await user.click(screen.getByRole("tab", { name: "Linux" }));

    const value = getCommandValue();
    expect(value).toContain("OTEL_EXPORTER_OTLP_ENDPOINT");
    expect(value).toContain("OTEL_EXPORTER_OTLP_HEADERS");
    expect(value).not.toContain("ELASTIC_ENDPOINT");
  });

  it("uses OTEL_EXPORTER_OTLP_ENDPOINT env var for Docker when OTLP is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Managed OTLP" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    await user.click(screen.getByRole("tab", { name: "Docker" }));

    const value = getCommandValue();
    expect(value).toContain("OTEL_EXPORTER_OTLP_ENDPOINT");
    expect(value).toContain("OTEL_EXPORTER_OTLP_HEADERS");
  });

  it("uses OTEL env vars for Windows when OTLP is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Managed OTLP" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    await user.click(screen.getByRole("tab", { name: "Windows" }));

    const value = getCommandValue();
    expect(value).toContain("OTEL_EXPORTER_OTLP_ENDPOINT");
    expect(value).toContain("OTEL_EXPORTER_OTLP_HEADERS");
  });

  it("reverts to ES env vars when switching back to Elasticsearch", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Managed OTLP" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    await user.click(screen.getByRole("tab", { name: "Linux" }));
    expect(getCommandValue()).toContain("OTEL_EXPORTER_OTLP_ENDPOINT");

    await user.click(screen.getByRole("button", { name: "Elasticsearch" }));

    const value = getCommandValue();
    expect(value).toContain("ELASTIC_ENDPOINT");
    expect(value).toContain("ELASTIC_API_KEY");
  });

  it("keeps Kubernetes command in Elasticsearch mode when OTLP is selected", async () => {
    renderPage();
    await waitFor(() => {
      expect(getCommandValue()).toContain(
        "Kubernetes quickstart currently supports Elasticsearch output only",
      );
    });
    expect(getCommandValue()).toContain(
      "elastic_endpoint='https://my-project.es.us-east-1.aws.elastic.cloud:443'",
    );
    expect(getCommandValue()).not.toContain(".ingest.");
  });

  it("does not probe when connection URL is not Elastic Cloud", async () => {
    resetAllStores();
    useConnectionStore.getState().setConnection({
      url: "http://localhost:9200",
      apiKey: "testkey",
    });
    useConnectionStore.setState({ capabilities: defaultCapabilities });
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText("Starter command")).toBeInTheDocument();
    });
    // No probe should be triggered since derivedOtlpUrl is null for non-Cloud URLs
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(".ingest."),
      expect.anything(),
    );
  });
});

describe("probeOtlpEndpoint", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when fetch resolves", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    expect(await probeOtlpEndpoint("https://x.ingest.us.aws.elastic.cloud")).toBe(true);
  });

  it("returns false when fetch rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    expect(await probeOtlpEndpoint("https://x.ingest.us.aws.elastic.cloud")).toBe(false);
  });

  it("returns false when fetch times out", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, opts) =>
        new Promise((_resolve, reject) => {
          (opts as RequestInit).signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    expect(await probeOtlpEndpoint("https://x.ingest.us.aws.elastic.cloud", 50)).toBe(false);
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

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AddDataPage from "../../src/components/AddDataPage";
import {
  deriveOtlpEndpoint,
  deriveIngestCandidates,
  probeOtlpEndpoint,
  detectTelemetrySignals,
} from "../../src/utils/addDataUtils";
import type { UserCapabilities, ElasticsearchClient } from "../../src/services/es";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const mockGetDataStreams = vi.fn().mockResolvedValue({ data_streams: [] });
// Required because ingestion verification now uses rawRequest via gracefulSearch.
const mockRawRequest = vi.fn().mockResolvedValue({ status: 200, body: {} });

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getClusterInfo: vi.fn().mockResolvedValue({ version: { number: "8.17.0" } }),
    createApiKey: vi.fn().mockResolvedValue({ id: "1", name: "k", encodedApiKey: "abc123" }),
    getDataStreams: mockGetDataStreams,
    rawRequest: mockRawRequest,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

// Mock probeOtlpEndpoint to resolve synchronously, eliminating the async
// fetch + setTimeout cycle that causes non-deterministic re-renders on mount.
// Other exports are kept real so utility-function tests still work.
vi.mock("../../src/utils/addDataUtils", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, probeOtlpEndpoint: vi.fn().mockResolvedValue(true) };
});

const fetchSpy = vi.spyOn(globalThis, "fetch");

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/add-data"]}>
      <Routes>
        <Route path="/add-data" element={<AddDataPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function goToStep2(user: ReturnType<typeof userEvent.setup>) {
  // Click the Kubernetes experience tile
  await user.click(screen.getByRole("button", { name: /Kubernetes/ }));
  // Select the Kubernetes technology card by matching exact text content
  // (Docker's card also contains "Kubernetes" in its experience label chip)
  const candidates = screen.getAllByRole("button", { name: /Kubernetes/, pressed: false });
  const kubernetesCard = candidates.find((el) => /^Kubernetes/i.test(el.textContent ?? ""));
  expect(kubernetesCard).toBeDefined();
  await user.click(kubernetesCard!);
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
    mockGetDataStreams.mockResolvedValue({ data_streams: [] });
    mockRawRequest.mockResolvedValue({ status: 200, body: {} });
    vi.mocked(probeOtlpEndpoint).mockResolvedValue(true);
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));
    useConnectionStore.getState().setConnection({
      url: "https://my-project.es.us-east-1.aws.elastic.cloud:443",
      apiKey: "testkey",
    });
    useConnectionStore.setState({ capabilities: defaultCapabilities });
  });

  it("renders Step 1 with search and experience tiles", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /What are we observing\?/i })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search technologies (e.g., PostgreSQL, Kubernetes...)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Cloud Providers")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(screen.getByText("Servers, Desktops & Laptops")).toBeInTheDocument();
    expect(screen.getByText("SaaS & Databases")).toBeInTheDocument();
  }, 15_000);

  it("filters technologies by search and experience selection", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByPlaceholderText("Search technologies (e.g., PostgreSQL, Kubernetes...)"),
      "postgres",
    );
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.queryByText("Nginx")).not.toBeInTheDocument();

    await user.clear(
      screen.getByPlaceholderText("Search technologies (e.g., PostgreSQL, Kubernetes...)"),
    );
    // Click the SaaS & Databases experience tile to filter to database technologies
    await user.click(screen.getByRole("button", { name: /SaaS & Databases/ }));
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.queryByText("Linux Host")).not.toBeInTheDocument();
  }, 15_000);

  it("transitions through 3-step flow", async () => {
    const user = userEvent.setup();
    renderPage();

    // Step 1 → Step 2
    await goToStep2(user);
    expect(screen.getByRole("heading", { name: /Set up Kubernetes/i })).toBeInTheDocument();

    // Step 2 shows collapsible configure and install sections
    expect(screen.getByText("Select your environment")).toBeInTheDocument();
    expect(screen.getByText("Install and configure")).toBeInTheDocument();

    // Step 2 → Step 3
    await user.click(screen.getByRole("button", { name: /^Continue$/i }));
    // Step 3 shows "Next steps" (or "Explore your data + next steps" when verified)
    expect(screen.getByRole("heading", { name: /next steps/i })).toBeInTheDocument();
  }, 30_000);

  it("shows configure and install sections with credentials in merged Step 2", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToStep2(user);

    // Configure section shows endpoint type controls
    expect(screen.getByRole("button", { name: "Elasticsearch" })).toBeInTheDocument();
    expect(screen.getByText("Managed OTLP")).toBeInTheDocument();
    // Kubernetes has a single supported environment, so no redundant selector is shown.
    expect(screen.queryByRole("tab", { name: "Kubernetes" })).not.toBeInTheDocument();

    // Credentials section appears as its own section (between Configure and Install)
    expect(screen.getByText("Collector credentials")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate API key/i })).toBeInTheDocument();

    // Install section shows copy controls
    expect(screen.getByRole("button", { name: /Copy all/i })).toBeInTheDocument();

    // Verify section shows check button
    expect(screen.getByRole("button", { name: /Check now/i })).toBeInTheDocument();
  }, 30_000);

  it("hides environment tabs when only one environment is supported", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Servers, Desktops & Laptops/ }));
    await user.click(screen.getByRole("button", { name: /^Windows Host/i }));

    expect(screen.getByRole("heading", { name: /Set up Windows Host/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Windows" })).not.toBeInTheDocument();
  }, 30_000);

  it("shows contextual verification expectations in Step 2", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToStep2(user);
    expect(
      screen.getByText(/For Kubernetes, we expect to receive metrics, logs and traces\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Check now/i })).toBeInTheDocument();
  }, 30_000);

  it("shows Step 3 outcomes with dashboard/alerting/additional source CTAs", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToStep2(user);

    // Baseline capture will see empty data streams; subsequent poll calls
    // will see the new metrics data stream, triggering dataStreamAppeared.
    mockGetDataStreams.mockResolvedValueOnce({ data_streams: [] }).mockResolvedValue({
      data_streams: [{ name: "metrics-host.otel-default" }],
    });

    await user.click(screen.getByRole("button", { name: /Check now/i }));

    // Wait for detection (rich verification shows per-signal cards and summary alert)
    await waitFor(
      () => {
        expect(screen.getByText(/data stream.*appeared/i)).toBeInTheDocument();
      },
      { timeout: 10_000 },
    );

    // Navigate to Step 3
    await user.click(screen.getByRole("button", { name: /^Continue$/i }));

    // Technology-specific recommended next steps from Kubernetes catalog entry
    expect(screen.getByRole("button", { name: "Explore metrics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Query Lab" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open traces" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add another source" })).toBeInTheDocument();
  }, 30_000);

  it("resets state when clicking 'Add another source'", async () => {
    mockGetDataStreams.mockResolvedValue({
      data_streams: [{ name: "metrics-host.otel-default" }],
    });

    const user = userEvent.setup();
    renderPage();

    // Navigate to Step 3 via experience → technology → continue → continue
    await goToStep2(user);
    await user.click(screen.getByRole("button", { name: /^Continue$/i }));
    await user.click(screen.getByRole("button", { name: "Add another source" }));

    // Should return to Step 1 with a clean slate
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /What are we observing\?/i })).toBeInTheDocument();
    });
    expect(
      screen.getByPlaceholderText("Search technologies (e.g., PostgreSQL, Kubernetes...)"),
    ).toHaveValue("");
    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeDisabled();
  }, 30_000);

  it("shows OTLP alert when no ingest endpoint can be derived", async () => {
    // Use a non-cloud URL so no OTLP endpoint can be derived
    useConnectionStore.getState().setConnection({
      url: "http://localhost:9200",
      apiKey: "testkey",
    });

    const user = userEvent.setup();
    renderPage();

    await goToStep2(user);

    // Switch to Managed OTLP (text is inside a Tooltip span)
    await user.click(screen.getByText("Managed OTLP"));

    // The alert should appear even though no endpoint was derived
    await waitFor(() => {
      expect(screen.getByText(/Could not derive an OTLP endpoint/)).toBeInTheDocument();
    });
  }, 30_000);

  it("clears technology selection when search input is cleared", async () => {
    const user = userEvent.setup();
    renderPage();

    // Search for "java" to show the Java APM tile
    await user.type(
      screen.getByPlaceholderText("Search technologies (e.g., PostgreSQL, Kubernetes...)"),
      "java",
    );
    expect(screen.getByText("Java")).toBeInTheDocument();

    // Select the Java technology card (handleSelectAndContinue auto-advances to Step 2)
    const javaCard = screen.getByRole("button", { name: /^Java/i, pressed: false });
    await user.click(javaCard);

    // We're now on Step 2 — go back to Step 1
    await user.click(screen.getByRole("button", { name: /^Back$/i }));

    // Clear the search input
    await user.clear(
      screen.getByPlaceholderText("Search technologies (e.g., PostgreSQL, Kubernetes...)"),
    );

    // Continue button should be disabled (selection cleared)
    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeDisabled();
  }, 15_000);

  it("filters verified signals to only expected signals for APM technologies", async () => {
    const user = userEvent.setup();
    renderPage();

    // Search for Java to find APM tile, select it (auto-advances to Step 2)
    await user.type(
      screen.getByPlaceholderText("Search technologies (e.g., PostgreSQL, Kubernetes...)"),
      "java",
    );
    const javaCard = screen.getByRole("button", { name: /^Java/i, pressed: false });
    await user.click(javaCard);

    // Now on Step 2 — advance to Step 3
    await user.click(screen.getByRole("button", { name: /^Continue$/i }));

    // Step 3: with no foundSignals, should show expected signals (traces, metrics) — not logs
    expect(screen.getByText(/Expected signals: Traces, Metrics\./)).toBeInTheDocument();
    expect(screen.queryByText(/Logs/)).not.toBeInTheDocument();
  }, 30_000);

  it("shows Open Services CTA for APM technologies in Step 3", async () => {
    const user = userEvent.setup();
    renderPage();

    // Search for Java to find APM tile, select it (auto-advances to Step 2)
    await user.type(
      screen.getByPlaceholderText("Search technologies (e.g., PostgreSQL, Kubernetes...)"),
      "java",
    );
    const javaCard = screen.getByRole("button", { name: /^Java/i, pressed: false });
    await user.click(javaCard);

    // Now on Step 2 → Step 3
    await user.click(screen.getByRole("button", { name: /^Continue$/i }));

    // Step 3 should show Open Services CTA
    expect(screen.getByRole("button", { name: "Open Services" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open traces" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore metrics" })).toBeInTheDocument();
  }, 30_000);
});

describe("probeOtlpEndpoint", () => {
  // The module-level vi.mock replaces probeOtlpEndpoint with a stub for the
  // component tests above.  These utility tests need the real implementation.
  let realProbeOtlpEndpoint: typeof probeOtlpEndpoint;
  beforeAll(async () => {
    const mod = (await vi.importActual("../../src/utils/addDataUtils")) as {
      probeOtlpEndpoint: typeof probeOtlpEndpoint;
    };
    realProbeOtlpEndpoint = mod.probeOtlpEndpoint;
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when fetch resolves", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    expect(await realProbeOtlpEndpoint("https://x.ingest.us.aws.elastic.cloud")).toBe(true);
  });

  it("returns false when fetch rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    expect(await realProbeOtlpEndpoint("https://x.ingest.us.aws.elastic.cloud")).toBe(false);
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
    expect(await realProbeOtlpEndpoint("https://x.ingest.us.aws.elastic.cloud", 50)).toBe(false);
  });
});

describe("deriveOtlpEndpoint", () => {
  it("derives OTLP endpoint from Elastic Cloud ES URL", () => {
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

  it("derives ingest URL from cloud.es.io ES URL", () => {
    expect(deriveOtlpEndpoint("https://elastic-peek-010bd2.es.us-central1.gcp.cloud.es.io")).toBe(
      "https://elastic-peek-010bd2.ingest.us-central1.gcp.cloud.es.io",
    );
  });

  it("derives ingest URL from cloud.es.io Kibana URL (.kb.)", () => {
    expect(deriveOtlpEndpoint("https://elastic-peek-010bd2.kb.us-central1.gcp.cloud.es.io")).toBe(
      "https://elastic-peek-010bd2.ingest.us-central1.gcp.cloud.es.io",
    );
  });

  it("returns null for non-Elastic Cloud URL", () => {
    expect(deriveOtlpEndpoint("http://localhost:9200")).toBeNull();
  });
});

describe("detectTelemetrySignals", () => {
  it("returns matching signal types from data streams", async () => {
    const client = {
      getDataStreams: vi.fn().mockResolvedValue({
        data_streams: [
          { name: "logs-generic.otel-default" },
          { name: "metrics-host.otel-default" },
          { name: "traces-generic.otel-default" },
        ],
      }),
    } as unknown as ElasticsearchClient;
    const signals = await detectTelemetrySignals(client);
    expect(signals).toEqual(new Set(["logs", "metrics", "traces"]));
  });

  it("returns empty set when no telemetry streams exist", async () => {
    const client = {
      getDataStreams: vi.fn().mockResolvedValue({ data_streams: [] }),
    } as unknown as ElasticsearchClient;
    const signals = await detectTelemetrySignals(client);
    expect(signals.size).toBe(0);
  });
});

describe("deriveIngestCandidates", () => {
  it("returns single candidate for elastic.cloud URLs", () => {
    expect(deriveIngestCandidates("https://my-deploy.es.us-east-1.aws.elastic.cloud")).toEqual([
      "https://my-deploy.ingest.us-east-1.aws.elastic.cloud",
    ]);
  });

  it("returns two candidates for cloud.es.io URLs", () => {
    const candidates = deriveIngestCandidates(
      "https://elastic-peek-010bd2.es.us-central1.gcp.cloud.es.io",
    );
    expect(candidates).toEqual([
      "https://elastic-peek-010bd2.ingest.us-central1.gcp.cloud.es.io",
      "https://elastic-peek-010bd2.ingest.us-central1.gcp.elastic-cloud.com",
    ]);
  });

  it("returns empty array for non-cloud URLs", () => {
    expect(deriveIngestCandidates("http://localhost:9200")).toEqual([]);
  });
});

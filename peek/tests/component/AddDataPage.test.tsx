// @vitest-environment jsdom
// happy-dom has a known issue with navigation/routing in this component's tests
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
import { ADD_DATA_TECHNOLOGY_CATALOG } from "../../src/services/addData/catalog";
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

async function chooseRecommendedCollector(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Monitor with OpenTelemetry Collector/i }));
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
    mockRawRequest.mockImplementation(async () => ({
      status: 200,
      body: {
        hits: { total: { value: 120, relation: "eq" } },
        aggregations: {
          latest: { value_as_string: new Date().toISOString() },
          host_count: { value: 1 },
          service_count: { value: 1 },
          agent_count: { value: 1 },
        },
      },
    }));
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
    expect(
      screen.getByRole("heading", { name: /What do you want to monitor\?/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search technologies (e.g., PostgreSQL, Kubernetes...)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Cloud and SaaS")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(screen.getByText("Laptops and Servers")).toBeInTheDocument();
    expect(screen.getByText("Applications (APM Agents)")).toBeInTheDocument();
  }, 15_000);

  it("shows third-party collectors under Custom Collectors & Pipelines", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /^Custom Collectors & Pipelines\b/i }));

    expect(screen.getByRole("button", { name: /^Fluent Bit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Vector/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Fluentd/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Filebeat/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Logstash/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Java$/i })).not.toBeInTheDocument();
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
    // Click the Cloud and SaaS hero tile to filter cloud/db technologies
    await user.click(screen.getByRole("button", { name: /Cloud and SaaS/ }));
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.queryByText("Linux Host")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /SaaS & Databases/i })[0]!);
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.queryByText(/^AWS$/i)).not.toBeInTheDocument();
  }, 15_000);

  it("keeps next steps locked until verification", async () => {
    const user = userEvent.setup();
    renderPage();

    // Step 1 → Step 2
    await goToStep2(user);
    expect(screen.getByRole("heading", { name: /Set up Kubernetes/i })).toBeInTheDocument();

    // Step 2 shows collapsible configure and install sections
    expect(screen.getByText("Choose collector")).toBeInTheDocument();
    expect(screen.queryByText("Install and configure")).not.toBeInTheDocument();

    // Step 2 keeps Continue disabled until verification signals are detected.
    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: /next steps/i })).not.toBeInTheDocument();
  }, 30_000);

  it("allows skipping verification to proceed to Step 3", async () => {
    // Return empty data streams so verification never detects data
    mockGetDataStreams.mockResolvedValue({ data_streams: [] });
    mockRawRequest.mockResolvedValue({
      status: 200,
      body: { hits: { total: { value: 0, relation: "eq" } } },
    });

    const user = userEvent.setup();
    renderPage();

    await goToStep2(user);
    await chooseRecommendedCollector(user);

    // Wait for verification to start polling so the skip button appears
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /Skip verification/i })).toBeInTheDocument();
      },
      { timeout: 10_000 },
    );

    // Continue should be disabled before skipping
    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeDisabled();

    // Click skip verification
    await user.click(screen.getByRole("button", { name: /Skip verification/i }));

    // Continue should now be enabled
    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeEnabled();

    // Click Continue to reach Step 3
    await user.click(screen.getByRole("button", { name: /^Continue$/i }));
    expect(screen.getByRole("button", { name: "Add another source" })).toBeInTheDocument();
  }, 30_000);

  it("shows configure and install sections with credentials in merged Step 2", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToStep2(user);

    // Configure section requires explicit choice and exposes alternatives.
    expect(
      screen.getByRole("button", { name: /Monitor with OpenTelemetry Collector/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Other collector options/i })).toBeInTheDocument();
    // Kubernetes has a single supported environment, so no redundant selector is shown.
    expect(screen.queryByRole("tab", { name: "Kubernetes" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Monitor with OpenTelemetry Collector/i }));

    // Credentials section appears as its own section (between Configure and Install)
    expect(screen.getByText("Collector configuration")).toBeInTheDocument();
    expect(
      screen.queryByText(/Managed OTLP endpoint detected and selected/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate API key/i })).toBeInTheDocument();

    // Install section shows quick command / step by step toggle
    expect(screen.getByRole("button", { name: /Quick command/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Step by step/i })).toBeInTheDocument();

    // Verify section is shown and AI troubleshooting action is available while listening
    expect(
      screen.getAllByText(/Kubernetes sends metrics, logs, and traces/i).length,
    ).toBeGreaterThan(0);
  }, 30_000);

  it("hides configure output for single-mode collectors", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /^Custom Collectors & Pipelines\b/i }));
    await user.click(screen.getByRole("button", { name: /^Filebeat/i }));

    expect(screen.getByRole("heading", { name: /Set up Filebeat/i })).toBeInTheDocument();
    expect(screen.queryByText("Configure output")).not.toBeInTheDocument();
    expect(screen.getByText("Install collector")).toBeInTheDocument();
    expect(screen.getByText("Collector configuration")).toBeInTheDocument();
  }, 30_000);

  it("guides AWS setup step-by-step (configure -> credentials -> deploy)", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Cloud and SaaS/i }));
    await user.click(screen.getByRole("button", { name: /^AWS/i }));

    expect(
      screen.getByRole("heading", { name: /Set up Amazon Web Services/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("How should we connect?")).toBeInTheDocument();
    expect(
      screen.queryByText("Amazon Data Firehose -> Elastic Credentials"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Deploy stack")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Amazon Data Firehose/i }));
    expect(screen.getByText("Connecting using AWS Firehose")).toBeInTheDocument();

    expect(screen.getByText("Amazon Data Firehose -> Elastic Credentials")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Deploy stack")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Checking\.\.\./i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Launch stack in AWS Console/i }));
    expect(screen.getAllByText(/Checking\.\.\./i).length).toBeGreaterThan(0);
  }, 30_000);

  it("shows manual CLI tab for AWS deploy", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Cloud and SaaS/i }));
    await user.click(screen.getByRole("button", { name: /^AWS/i }));
    await user.click(screen.getByRole("button", { name: /Amazon Data Firehose/i }));
    await user.click(screen.getByRole("button", { name: /Generate API key/i }));
    await waitFor(() => {
      expect(screen.getByText("Deploy stack")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /Manual CLI/i }));
    expect(screen.getByRole("button", { name: /Copy CLI command/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open CloudShell/i })).toBeInTheDocument();
    expect(screen.getByText(/aws cloudformation deploy/)).toBeInTheDocument();
  }, 30_000);

  it("hides environment tabs when only one environment is supported", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Servers/i }));
    await user.click(screen.getByRole("button", { name: /^Windows Host/i }));

    expect(screen.getByRole("heading", { name: /Set up Windows Host/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Windows" })).not.toBeInTheDocument();
  }, 30_000);

  it("does not show host runtime tabs in Prometheus setup", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /^Custom Collectors & Pipelines\b/i }));
    await user.click(screen.getByRole("button", { name: /Scrape Prometheus Metrics with OTel/i }));
    await user.click(screen.getByRole("button", { name: /Monitor with OpenTelemetry Collector/i }));

    expect(screen.queryByRole("tab", { name: /^Kubernetes$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /^Docker$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /^Linux$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /^macOS$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /^Windows$/i })).not.toBeInTheDocument();
  }, 30_000);

  it("shows a separate Prometheus Remote Write tile", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /^Custom Collectors & Pipelines\b/i }));
    expect(
      screen.getByRole("button", { name: /Scrape Prometheus Metrics with OTel/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Prometheus Remote Write/i })).toBeInTheDocument();
  }, 15_000);

  it("auto-detects host architecture in generated commands", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Servers/i }));
    await user.click(screen.getByRole("button", { name: /^Linux Host/i }));
    await chooseRecommendedCollector(user);

    await waitFor(() => {
      expect(screen.getByText(/Linux command guide/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Run once/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Install on Debian\/Ubuntu \(\.deb\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Install on Red Hat\/CentOS \(\.rpm\)/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/AGENT_ARCH="\$\(uname -m \| sed -E/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/aarch64\|arm64/i).length).toBeGreaterThan(0);
    // Run once (default): uses generic tar.gz
    expect(screen.getAllByText(/\.tar\.gz/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tar xzvf/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Show full command/i }));
    expect(
      screen.getAllByText(/cp .*otel_samples.*platformlogs_hostmetrics\.yml.*otel\.yml/i).length,
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Install on Debian\/Ubuntu \(\.deb\)/i }));
    expect(screen.getAllByText(/sudo dpkg -i "\$PKG_FILE"/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Install on Red Hat\/CentOS \(\.rpm\)/i }));
    expect(screen.getAllByText(/sudo rpm -Uvh "\$PKG_FILE"/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/elastic-agent-otel\.service/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/systemctl enable --now elastic-agent-otel\.service/i).length,
    ).toBeGreaterThan(0);
  }, 30_000);

  it("shows contextual verification expectations in Step 2", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToStep2(user);
    await chooseRecommendedCollector(user);
    expect(
      screen.getAllByText(/Kubernetes sends metrics, logs, and traces/i).length,
    ).toBeGreaterThan(0);
  }, 30_000);

  it("uses Elasticsearch URL for APM SDK snippets", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Applications \(APM Agents\)/i }));
    await user.click(screen.getByRole("button", { name: /^Java Auto-instrument/i }));

    await waitFor(() => {
      expect(screen.getByText(/Initialize in your app/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/my-project\.es\.us-east-1\.aws\.elastic\.cloud/i)).toBeInTheDocument();
  }, 30_000);

  it("shows Step 3 outcomes with dashboard/alerting/additional source CTAs", async () => {
    const user = userEvent.setup();
    // Baseline capture will see empty data streams; subsequent poll calls
    // will see the new metrics data stream, triggering dataStreamAppeared.
    mockGetDataStreams.mockResolvedValueOnce({ data_streams: [] }).mockResolvedValue({
      data_streams: [{ name: "metrics-host.otel-default" }],
    });

    renderPage();
    await goToStep2(user);
    await chooseRecommendedCollector(user);

    // Wait for detection and unlocked progression.
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /^Continue$/i })).toBeEnabled();
      },
      { timeout: 10_000 },
    );

    // Navigate to Step 3
    await user.click(screen.getByRole("button", { name: /^Continue$/i }));

    // Technology-specific recommended next steps from Kubernetes catalog entry
    expect(screen.getByRole("button", { name: "Explore metrics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Logs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Query Lab" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open traces" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add another source" })).toBeInTheDocument();
  }, 30_000);

  it("ensures every log-emitting technology has an Open Logs next step", () => {
    const missing = ADD_DATA_TECHNOLOGY_CATALOG.filter((entry) =>
      entry.expectedSignals.includes("logs"),
    )
      .filter(
        (entry) =>
          !entry.recommendedNextSteps.some(
            (step) => step.label === "Open Logs" && step.path === "/logs",
          ),
      )
      .map((entry) => entry.id);

    expect(missing).toEqual([]);
  });

  it("resets state when clicking 'Add another source'", async () => {
    mockGetDataStreams.mockResolvedValueOnce({ data_streams: [] }).mockResolvedValue({
      data_streams: [{ name: "metrics-host.otel-default" }],
    });

    const user = userEvent.setup();
    renderPage();

    // Navigate to Step 3 via experience → setup verification → continue
    await goToStep2(user);
    await chooseRecommendedCollector(user);
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /^Continue$/i })).toBeEnabled();
      },
      { timeout: 10_000 },
    );
    await user.click(screen.getByRole("button", { name: /^Continue$/i }));
    await user.click(screen.getByRole("button", { name: "Add another source" }));

    // Should return to Step 1 with a clean slate
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /What do you want to monitor\?/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByPlaceholderText("Search technologies (e.g., PostgreSQL, Kubernetes...)"),
    ).toHaveValue("");
    expect(screen.queryByRole("button", { name: /^Continue$/i })).not.toBeInTheDocument();
  }, 30_000);

  it("shows collector output and API key section for collector setup", async () => {
    useConnectionStore.getState().setConnection({
      url: "http://localhost:9200",
      apiKey: "testkey",
    });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Laptops and Servers/i }));
    await user.click(screen.getByRole("button", { name: /Linux Host/i }));
    await user.click(screen.getByRole("button", { name: /Monitor with OpenTelemetry Collector/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Bulk/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /OTLP/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue("http://localhost:9200")).toBeInTheDocument();
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

    // Technology selection should be cleared — re-search and Java card should appear as not selected
    await user.type(
      screen.getByPlaceholderText("Search technologies (e.g., PostgreSQL, Kubernetes...)"),
      "java",
    );
    expect(screen.getByRole("button", { name: /^Java/i, pressed: false })).toBeInTheDocument();
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
    // Baseline call sees no data streams; subsequent polls see APM traces stream.
    mockGetDataStreams.mockResolvedValueOnce({ data_streams: [] }).mockResolvedValue({
      data_streams: [{ name: "traces-apm-default" }],
    });

    const user = userEvent.setup();
    renderPage();

    // Search for Java to find APM tile, select it (auto-advances to Step 2)
    await user.type(
      screen.getByPlaceholderText("Search technologies (e.g., PostgreSQL, Kubernetes...)"),
      "java",
    );
    const javaCard = screen.getByRole("button", { name: /^Java/i, pressed: false });
    await user.click(javaCard);

    // Wait for verification to detect the trace data stream and enable Continue.
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /^Continue$/i })).toBeEnabled();
      },
      { timeout: 10_000 },
    );

    // Now on Step 2 → Step 3
    await user.click(screen.getByRole("button", { name: /^Continue$/i }));

    // Step 3 should show Open Services CTA
    expect(screen.getByRole("button", { name: "Open Services" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open traces" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore metrics" })).toBeInTheDocument();
  }, 30_000);

  it("resets setup flow when clicking Start over", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Cloud and SaaS/i }));
    await user.click(screen.getByRole("button", { name: /^AWS/i }));
    await user.click(screen.getByRole("button", { name: /Amazon Data Firehose/i }));
    expect(screen.getByText("Connecting using AWS Firehose")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Start over/i }));
    // Start over now navigates back to Step 1 (technology selection)
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /What do you want to monitor\?/i }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Connecting using AWS Firehose")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Set up Amazon Web Services/i }),
    ).not.toBeInTheDocument();
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
  it("derives OTLP endpoint from Elastic Cloud ES URL with explicit port", () => {
    expect(deriveOtlpEndpoint("https://my-project.es.us-east-1.aws.elastic.cloud:443")).toBe(
      "https://my-project.ingest.us-east-1.aws.elastic.cloud:443",
    );
  });

  it("includes default port when Elastic Cloud URL has no explicit port", () => {
    expect(deriveOtlpEndpoint("https://abc123.es.eu-west-1.aws.elastic.cloud")).toBe(
      "https://abc123.ingest.eu-west-1.aws.elastic.cloud:443",
    );
  });

  it("preserves non-default port", () => {
    expect(deriveOtlpEndpoint("https://abc123.es.eu-west-1.aws.elastic.cloud:9243")).toBe(
      "https://abc123.ingest.eu-west-1.aws.elastic.cloud:9243",
    );
  });

  it("handles URL with trailing slash", () => {
    expect(deriveOtlpEndpoint("https://abc123.es.eu-west-1.aws.elastic.cloud/")).toBe(
      "https://abc123.ingest.eu-west-1.aws.elastic.cloud:443",
    );
  });

  it("derives ingest URL from cloud.es.io ES URL", () => {
    expect(deriveOtlpEndpoint("https://elastic-peek-010bd2.es.us-central1.gcp.cloud.es.io")).toBe(
      "https://elastic-peek-010bd2.ingest.us-central1.gcp.cloud.es.io:443",
    );
  });

  it("derives ingest URL from cloud.es.io Kibana URL (.kb.)", () => {
    expect(deriveOtlpEndpoint("https://elastic-peek-010bd2.kb.us-central1.gcp.cloud.es.io")).toBe(
      "https://elastic-peek-010bd2.ingest.us-central1.gcp.cloud.es.io:443",
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

  it("for host onboarding, metrics requires hostmetricsreceiver streams", async () => {
    const client = {
      getDataStreams: vi.fn().mockResolvedValue({
        data_streams: [
          { name: "metrics-host.otel-default" },
          { name: "metrics-hostmetricsreceiver.otel-default" },
        ],
      }),
    } as unknown as ElasticsearchClient;
    const signalsDefault = await detectTelemetrySignals(client, undefined, false);
    const signalsHost = await detectTelemetrySignals(client, undefined, true);
    expect(signalsDefault).toContain("metrics");
    expect(signalsHost).toContain("metrics");
  });

  it("for host onboarding, metrics is absent without hostmetricsreceiver", async () => {
    const client = {
      getDataStreams: vi.fn().mockResolvedValue({
        data_streams: [{ name: "metrics-host.otel-default" }],
      }),
    } as unknown as ElasticsearchClient;
    const signals = await detectTelemetrySignals(client, undefined, true);
    expect(signals.has("metrics")).toBe(false);
  });
});

describe("deriveIngestCandidates", () => {
  it("returns single candidate for elastic.cloud URLs", () => {
    expect(deriveIngestCandidates("https://my-deploy.es.us-east-1.aws.elastic.cloud")).toEqual([
      "https://my-deploy.ingest.us-east-1.aws.elastic.cloud:443",
    ]);
  });

  it("returns two candidates for cloud.es.io URLs", () => {
    const candidates = deriveIngestCandidates(
      "https://elastic-peek-010bd2.es.us-central1.gcp.cloud.es.io",
    );
    expect(candidates).toEqual([
      "https://elastic-peek-010bd2.ingest.us-central1.gcp.cloud.es.io:443",
      "https://elastic-peek-010bd2.ingest.us-central1.gcp.elastic-cloud.com:443",
    ]);
  });

  it("returns empty array for non-cloud URLs", () => {
    expect(deriveIngestCandidates("http://localhost:9200")).toEqual([]);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
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

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    getClusterInfo: vi.fn().mockResolvedValue({ version: { number: "8.17.0" } }),
    createApiKey: vi.fn().mockResolvedValue({ id: "1", name: "k", encodedApiKey: "abc123" }),
    getDataStreams: mockGetDataStreams,
  })),
  isElasticsearchError: (err: unknown) => {
    if (typeof err !== "object" || err === null) return false;
    const obj = err as Record<string, unknown>;
    return typeof obj.status === "number" && typeof obj.message === "string";
  },
}));

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
  await user.click(screen.getByRole("button", { name: "Kubernetes" }));
  await user.click(screen.getByRole("button", { name: /Continue to step 2/i }));
}

async function goToStep4(user: ReturnType<typeof userEvent.setup>) {
  await goToStep2(user);
  await user.click(screen.getByRole("button", { name: /Continue to step 3/i }));
  await user.click(screen.getByRole("button", { name: /Continue to step 4/i }));
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
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));
    useConnectionStore.getState().setConnection({
      url: "https://my-project.es.us-east-1.aws.elastic.cloud:443",
      apiKey: "testkey",
    });
    useConnectionStore.setState({ capabilities: defaultCapabilities });
  });

  it("renders Step 1 with search, category filters, and recommended technologies", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /Step 1: What are you monitoring\?/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Search technologies")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kubernetes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Docker" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Linux Host" })).toBeInTheDocument();
  });

  it("filters technologies by search and category", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Search technologies"), "postgres");
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.queryByText("Nginx")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search technologies"));
    await user.click(screen.getByRole("button", { name: "Databases" }));
    expect(screen.getByText(/Databases • Capture query performance/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Operating Systems • Install EDOT Collector on Linux hosts\/VMs\./),
    ).not.toBeInTheDocument();
  });

  it("transitions through explicit 5-step flow", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToStep2(user);
    expect(
      screen.getByRole("heading", { name: /Step 2: Select your environment/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Continue to step 3/i }));
    expect(
      screen.getByRole("heading", { name: /Step 3: Install and configure/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Continue to step 4/i }));
    expect(
      screen.getByRole("heading", { name: /Step 4: Validate data receipt/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Continue to step 5/i }));
    expect(
      screen.getByRole("heading", { name: /Step 5: Explore your data \+ next steps/i }),
    ).toBeInTheDocument();
  });

  it("reuses endpoint type and platform controls in Step 2/3", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToStep2(user);
    expect(screen.getByRole("button", { name: "Elasticsearch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Managed OTLP" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Linux" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Continue to step 3/i }));
    expect(screen.getByRole("button", { name: /Copy all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate API key/i })).toBeInTheDocument();
  });

  it("shows contextual verification expectations in Step 4", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToStep4(user);
    expect(
      screen.getByText(/For Kubernetes, we expect to receive metrics, logs and traces\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Check now/i })).toBeInTheDocument();
  });

  it("shows contextual step 5 outcomes with dashboard/alerting/additional source CTAs", async () => {
    const user = userEvent.setup();
    renderPage();

    await goToStep4(user);

    // The mount-time detectTelemetrySignals effect should have already fired.
    expect(mockGetDataStreams).toHaveBeenCalled();

    // Set up mock AFTER navigation so the mount-time detectTelemetrySignals
    // call has already resolved with the default (empty) mock.  The next
    // getDataStreams invocation — triggered by "Check now" — will return
    // partial data immediately, avoiding a 5 s polling wait.
    mockGetDataStreams.mockResolvedValueOnce({
      data_streams: [{ name: "metrics-host.otel-default" }],
    });

    await user.click(screen.getByRole("button", { name: /Check now/i }));

    await waitFor(() => {
      expect(screen.getByText(/Telemetry data detected!/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Partial success/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Continue to step 5/i }));

    expect(screen.getByRole("button", { name: "Open Dashboards" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set up alerting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add another source" })).toBeInTheDocument();
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

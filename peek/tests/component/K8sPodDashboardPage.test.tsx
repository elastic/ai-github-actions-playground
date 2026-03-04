import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import K8sPodDashboardPage from "../../src/components/kubernetes/K8sPodDashboardPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const mockRunQuery = vi.fn();

const POD_DETAIL_RESPONSE = {
  columns: [
    { name: "avg_cpu", type: "double" },
    { name: "avg_memory", type: "long" },
    { name: "restarts", type: "long" },
    { name: "pod_name", type: "keyword" },
    { name: "namespace_name", type: "keyword" },
    { name: "node_name", type: "keyword" },
    { name: "container_name", type: "keyword" },
  ],
  values: [
    [0.3, 256000000, 0, "web-abc123", "default", "node-1", "nginx"],
    [0.2, 128000000, 1, "web-abc123", "default", "node-1", "sidecar"],
  ],
};

const EMPTY_RESPONSE = { columns: [], values: [] };

function responseForQuery(query: string) {
  if (query.includes('k8s.pod.name == "web-abc123"')) return POD_DETAIL_RESPONSE;
  return EMPTY_RESPONSE;
}

vi.mock("../../src/hooks/useEsqlQuery", () => ({
  useEsqlQuery: (opts: {
    onSuccess: (data: unknown, executedQuery: string, executedStepIndex: number | null) => void;
  }) => ({
    runQuery: (query: string) => {
      mockRunQuery(query);
      opts.onSuccess(responseForQuery(query), query, null);
    },
    loading: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

let queryClient: QueryClient;

function renderPage(podName = "web-abc123") {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/kubernetes/pod/${podName}`]}>
        <Routes>
          <Route path="/kubernetes/pod/:podName" element={<K8sPodDashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("K8sPodDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("renders the pod name and empty state initially", () => {
    renderPage();
    expect(screen.getByText("web-abc123")).toBeInTheDocument();
    expect(screen.getByText("No pod data loaded")).toBeInTheDocument();
  });

  it("shows container table after clicking Search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("nginx")).toBeInTheDocument();
    expect(screen.getByText("sidecar")).toBeInTheDocument();
  });

  it("shows back navigation button", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "← Kubernetes" })).toBeInTheDocument();
  });

  it("clears data when Reset is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("nginx")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("No pod data loaded")).toBeInTheDocument();
  });
});

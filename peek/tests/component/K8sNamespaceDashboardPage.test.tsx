import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import K8sNamespaceDashboardPage from "../../src/components/kubernetes/K8sNamespaceDashboardPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const mockRunQuery = vi.fn();

const NAMESPACE_RESPONSE = {
  columns: [
    { name: "pod_count", type: "long" },
    { name: "avg_cpu", type: "double" },
    { name: "avg_memory", type: "double" },
    { name: "cluster_name", type: "keyword" },
    { name: "namespace_name", type: "keyword" },
  ],
  values: [[20, 0.5, 536870912, "prod-cluster", "kube-system"]],
};

const POD_RESPONSE = {
  columns: [
    { name: "avg_cpu", type: "double" },
    { name: "avg_memory", type: "long" },
    { name: "restarts", type: "long" },
    { name: "cluster_name", type: "keyword" },
    { name: "pod_name", type: "keyword" },
    { name: "namespace_name", type: "keyword" },
    { name: "node_name", type: "keyword" },
  ],
  values: [
    [0.1, 134217728, 0, "prod-cluster", "nginx-abc123", "kube-system", "node-1"],
    [0.3, 268435456, 2, "prod-cluster", "api-xyz789", "kube-system", "node-2"],
  ],
};

const EMPTY_RESPONSE = { columns: [], values: [] };

function responseForQuery(query: string) {
  if (/namespace_name = /.test(query) && !query.includes("node_name")) return NAMESPACE_RESPONSE;
  if (/pod_name = /.test(query)) return POD_RESPONSE;
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

function renderPage(namespace = "kube-system") {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/kubernetes/namespace/${namespace}`]}>
        <Routes>
          <Route path="/kubernetes/namespace/:namespace" element={<K8sNamespaceDashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("K8sNamespaceDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("renders the namespace name and empty state initially", () => {
    renderPage();
    expect(screen.getByText("kube-system")).toBeInTheDocument();
    expect(screen.getByText("No namespace data loaded")).toBeInTheDocument();
  });

  it("shows pod table after clicking Search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("nginx-abc123")).toBeInTheDocument();
    expect(screen.getByText("api-xyz789")).toBeInTheDocument();
  });

  it("shows back navigation button", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "← Kubernetes" })).toBeInTheDocument();
  });

  it("clears data when Reset is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("nginx-abc123")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("No namespace data loaded")).toBeInTheDocument();
  });
});

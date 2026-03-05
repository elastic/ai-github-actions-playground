import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import K8sClusterDashboardPage from "../../src/components/kubernetes/K8sClusterDashboardPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const mockRunQuery = vi.fn();

const CLUSTER_RESPONSE = {
  columns: [
    { name: "pod_count", type: "long" },
    { name: "avg_cpu", type: "double" },
    { name: "avg_memory", type: "long" },
    { name: "namespace_count", type: "long" },
    { name: "node_count", type: "long" },
    { name: "cluster_name", type: "keyword" },
  ],
  values: [[42, 0.75, 1073741824, 5, 3, "prod-cluster"]],
};

const NAMESPACE_RESPONSE = {
  columns: [
    { name: "pod_count", type: "long" },
    { name: "avg_cpu", type: "double" },
    { name: "avg_memory", type: "double" },
    { name: "cluster_name", type: "keyword" },
    { name: "namespace_name", type: "keyword" },
  ],
  values: [
    [20, 0.5, 536870912, "prod-cluster", "kube-system"],
    [15, 0.3, 268435456, "prod-cluster", "default"],
  ],
};

const LOGS_RESPONSE = {
  columns: [
    { name: "@timestamp", type: "date" },
    { name: "k8s.pod.name", type: "keyword" },
    { name: "k8s.namespace.name", type: "keyword" },
    { name: "k8s.container.name", type: "keyword" },
    { name: "message", type: "text" },
  ],
  values: [],
};

const TRACES_RESPONSE = {
  columns: [
    { name: "@timestamp", type: "date" },
    { name: "service.name", type: "keyword" },
    { name: "k8s.pod.name", type: "keyword" },
    { name: "k8s.namespace.name", type: "keyword" },
    { name: "name", type: "keyword" },
    { name: "trace.id", type: "keyword" },
    { name: "span.id", type: "keyword" },
  ],
  values: [],
};

const EMPTY_RESPONSE = { columns: [], values: [] };

function responseForQuery(query: string) {
  if (query.includes("namespace_count = COUNT_DISTINCT")) return CLUSTER_RESPONSE;
  if (/namespace_name = /.test(query)) return NAMESPACE_RESPONSE;
  if (query.includes("FROM logs-")) return LOGS_RESPONSE;
  if (query.includes("FROM traces-")) return TRACES_RESPONSE;
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

function renderPage(clusterName = "prod-cluster") {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/kubernetes/cluster/${clusterName}`]}>
        <Routes>
          <Route path="/kubernetes/cluster/:clusterName" element={<K8sClusterDashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("K8sClusterDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("renders the cluster name and empty state initially", () => {
    renderPage();
    expect(screen.getByText("prod-cluster")).toBeInTheDocument();
    expect(screen.getByText("No cluster data loaded")).toBeInTheDocument();
  });

  it("shows summary cards and namespace table after clicking Search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("42")).toBeInTheDocument(); // pods count
    expect(screen.getByText("kube-system")).toBeInTheDocument();
    expect(screen.getByText("default")).toBeInTheDocument();
  });

  it("shows back navigation button", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "← Kubernetes" })).toBeInTheDocument();
  });

  it("clears data when Reset is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("kube-system")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("No cluster data loaded")).toBeInTheDocument();
  });
});

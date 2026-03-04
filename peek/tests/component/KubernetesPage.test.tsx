import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import KubernetesPage from "../../src/components/kubernetes/KubernetesPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { usePageFiltersStore } from "../../src/store/usePageFiltersStore";
import { resetAllStores } from "../fixtures/test-utils";

const mockRunQuery = vi.fn();

const CLUSTER_RESPONSE = {
  columns: [
    { name: "cluster_name", type: "keyword" },
    { name: "pod_count", type: "long" },
    { name: "avg_cpu", type: "double" },
    { name: "avg_memory", type: "double" },
    { name: "namespace_count", type: "long" },
    { name: "node_count", type: "long" },
  ],
  values: [
    ["prod-cluster", 120, 0.45, 2147483648, 8, 5],
    ["staging-cluster", 30, 0.2, 1073741824, 3, 2],
  ],
};

const NAMESPACE_RESPONSE = {
  columns: [
    { name: "namespace_name", type: "keyword" },
    { name: "pod_count", type: "long" },
    { name: "avg_cpu", type: "double" },
    { name: "avg_memory", type: "double" },
  ],
  values: [
    ["default", 40, 0.3, 1073741824],
    ["kube-system", 25, 0.5, 536870912],
  ],
};

const WORKLOAD_RESPONSE = {
  columns: [
    { name: "workload_kind", type: "keyword" },
    { name: "workload_name", type: "keyword" },
    { name: "pod_count", type: "long" },
    { name: "avg_cpu", type: "double" },
    { name: "avg_memory", type: "double" },
  ],
  values: [
    ["deployment", "nginx-deployment", 3, 0.15, 268435456],
    ["statefulset", "api-server", 2, 0.35, 536870912],
  ],
};

const POD_RESPONSE = {
  columns: [
    { name: "pod_name", type: "keyword" },
    { name: "namespace_name", type: "keyword" },
    { name: "node_name", type: "keyword" },
    { name: "avg_cpu", type: "double" },
    { name: "avg_memory", type: "double" },
    { name: "restarts", type: "long" },
  ],
  values: [
    ["nginx-abc123", "default", "node-1", 0.1, 134217728, 0],
    ["api-xyz789", "kube-system", "node-2", 0.3, 268435456, 2],
  ],
};

function responseForQuery(query: string) {
  if (query.includes("namespace_count = COUNT_DISTINCT")) return CLUSTER_RESPONSE;
  if (/BY namespace_name = /.test(query)) return NAMESPACE_RESPONSE;
  if (/workload_name = COALESCE\(/.test(query)) return WORKLOAD_RESPONSE;
  if (/BY pod_name = /.test(query)) return POD_RESPONSE;
  return POD_RESPONSE;
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

function renderPage() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/kubernetes"]}>
        <Routes>
          <Route path="/kubernetes" element={<KubernetesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("KubernetesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
    usePageFiltersStore.getState().resetKubernetesFilters();
  });

  it("renders page header and empty state initially", () => {
    renderPage();
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(screen.getByText("No Kubernetes data loaded")).toBeInTheDocument();
  });

  it("renders all four tabs", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: "Clusters" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Namespaces" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Workloads" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pods" })).toBeInTheDocument();
  });

  it("shows cluster table after clicking Search on Clusters tab", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    const table = await screen.findByRole("table", { name: "Cluster inventory" });
    expect(within(table).getByText("prod-cluster")).toBeInTheDocument();
    expect(within(table).getByText("staging-cluster")).toBeInTheDocument();
  });

  it("switches to Pods tab and shows pod table after search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: "Pods" }));
    await user.click(screen.getByRole("button", { name: "Search" }));

    const table = await screen.findByRole("table", { name: "Pod inventory" });
    expect(within(table).getByText("nginx-abc123")).toBeInTheDocument();
    expect(within(table).getByText("api-xyz789")).toBeInTheDocument();
  });

  it("switches to Namespaces tab and shows namespace table after search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: "Namespaces" }));
    await user.click(screen.getByRole("button", { name: "Search" }));

    const table = await screen.findByRole("table", { name: "Namespace inventory" });
    expect(within(table).getByText("default")).toBeInTheDocument();
    expect(within(table).getByText("kube-system")).toBeInTheDocument();
  });

  it("switches to Workloads tab and shows workload table after search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: "Workloads" }));
    await user.click(screen.getByRole("button", { name: "Search" }));

    const table = await screen.findByRole("table", { name: "Workload inventory" });
    expect(within(table).getByText("nginx-deployment")).toBeInTheDocument();
    expect(within(table).getByText("api-server")).toBeInTheDocument();
  });

  it("preserves active tab state in the filter store", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: "Pods" }));
    expect(usePageFiltersStore.getState().kubernetesFilters.activeTab).toBe("pods");

    await user.click(screen.getByRole("tab", { name: "Workloads" }));
    expect(usePageFiltersStore.getState().kubernetesFilters.activeTab).toBe("workloads");
  });

  it("shows result count after search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("2 clusters found")).toBeInTheDocument();
  });

  it("clears data when switching tabs", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("table", { name: "Cluster inventory" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Pods" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("No Kubernetes data loaded")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import K8sWorkloadDashboardPage from "../../src/components/kubernetes/K8sWorkloadDashboardPage";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const mockRunQuery = vi.fn();

const WORKLOAD_RESPONSE = {
  columns: [
    { name: "pod_count", type: "long" },
    { name: "avg_cpu", type: "double" },
    { name: "avg_memory", type: "double" },
    { name: "cluster_name", type: "keyword" },
    { name: "namespace_name", type: "keyword" },
    { name: "workload_kind", type: "keyword" },
    { name: "workload_name", type: "keyword" },
  ],
  values: [
    [3, 0.15, 268435456, "prod-cluster", "default", "deployment", "nginx-deployment"],
    [2, 0.35, 536870912, "prod-cluster", "default", "deployment", "api-server"],
  ],
};

const WORKLOAD_DETAIL_RESPONSE = {
  ...WORKLOAD_RESPONSE,
  values: [[3, 0.15, 268435456, "prod-cluster", "default", "deployment", "nginx-deployment"]],
};

const EMPTY_RESPONSE = { columns: [], values: [] };

function responseForQuery(query: string) {
  if (/k8s\.deployment\.name == "nginx-deployment"/.test(query)) return WORKLOAD_DETAIL_RESPONSE;
  if (/workload_name = COALESCE\(/.test(query)) return WORKLOAD_RESPONSE;
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

function renderPage(kind = "deployment", name = "nginx-deployment") {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/kubernetes/workload/${kind}/${name}`]}>
        <Routes>
          <Route path="/kubernetes/workload/:kind/:name" element={<K8sWorkloadDashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("K8sWorkloadDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    useConnectionStore
      .getState()
      .setConnection({ url: "https://example.es.local:9200", apiKey: "key" });
  });

  it("renders the workload kind and name, plus empty state initially", () => {
    renderPage();
    expect(screen.getByText("deployment: nginx-deployment")).toBeInTheDocument();
    expect(screen.getByText("No workload data loaded")).toBeInTheDocument();
  });

  it("shows workload table after clicking Search", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("nginx-deployment")).toBeInTheDocument();
    expect(screen.queryByText("api-server")).not.toBeInTheDocument();
  });

  it("shows back navigation button", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "← Kubernetes" })).toBeInTheDocument();
  });

  it("clears data when Reset is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("nginx-deployment")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("No workload data loaded")).toBeInTheDocument();
  });
});

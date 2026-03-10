import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useMarkdownEsql } from "../../src/hooks/useMarkdownEsql";
import type { DashboardParameter, ElasticsearchConnection, EsqlResponse } from "../../src/types";

const mockExecute = vi.fn();

vi.mock("../../src/services/perses/esqlDatasource", () => ({
  createPersesEsqlDatasource: () => ({ execute: mockExecute }),
  buildPersesEsqlRequest: (query: string, options: unknown) => ({ query, options }),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const CONNECTION: ElasticsearchConnection = {
  url: "http://localhost:9200",
  auth: { type: "none" },
};

const SAMPLE_RESPONSE: EsqlResponse = {
  columns: [{ name: "count", type: "long" }],
  values: [[1]],
};

describe("repro: markdown-esql queryKey over-scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(SAMPLE_RESPONSE);
  });

  it("does not refetch when only an unused parameter is reordered", async () => {
    const content = "${FROM logs-* | WHERE service.name == ?service | STATS c = COUNT(*)}";
    const service: DashboardParameter = {
      name: "service",
      label: "Service",
      type: "keyword",
      source: { mode: "text" },
      value: "checkout",
    };
    const env: DashboardParameter = {
      name: "env",
      label: "Environment",
      type: "keyword",
      source: { mode: "text" },
      value: "prod",
    };

    const { rerender } = renderHook(
      ({ parameters }: { parameters: DashboardParameter[] }) =>
        useMarkdownEsql({
          content,
          connection: CONNECTION,
          timeRange: { from: "now-15m", to: "now" },
          parameters,
        }),
      {
        wrapper: createWrapper(),
        initialProps: { parameters: [service, env] },
      },
    );

    await waitFor(() => expect(mockExecute).toHaveBeenCalledTimes(1));

    mockExecute.mockClear();
    rerender({ parameters: [env, service] });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockExecute).toHaveBeenCalledTimes(0);
  });
});

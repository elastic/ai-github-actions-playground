// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useResetAllStores } from "../../src/hooks/useResetAllStores";
import { useQueryStore } from "../../src/store/useQueryStore";
import { resetAllStores } from "../fixtures/test-utils";

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useResetAllStores", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("clears discover-result cache and resets registered stores", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["discover-result"], {
      columns: [
        { name: "@timestamp", type: "date" },
        { name: "message", type: "keyword" },
      ],
      values: [["2026-03-09T00:00:00.000Z", "hello"]],
    });
    useQueryStore.getState().setDiscoverQueryDraft("FROM logs-* | LIMIT 10");

    const { result } = renderHook(() => useResetAllStores(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current();
    });

    expect(queryClient.getQueryData(["discover-result"])).toBeUndefined();
    expect(useQueryStore.getState().discoverQueryDraft).toBeNull();
  });
});

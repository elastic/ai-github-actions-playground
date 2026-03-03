// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { generateText } from "ai";

import { clearInsightCache, usePageInsight } from "../../src/hooks/usePageInsight";
import { useLLMStore } from "../../src/store/useLLMStore";
import { resetAllStores } from "../fixtures/test-utils";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn(() => ({ id: "test-model" }))),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("usePageInsight – React Query", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    clearInsightCache();
    useLLMStore.getState().setApiKey("sk-test-key");
    vi.mocked(generateText).mockReset();
  });

  it("fetches an insight and caches it with staleTime: Infinity", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: "Cached insight." });

    const { result } = renderHook(
      () => usePageInsight({ context: "ctx", systemPrompt: "sys", cacheKey: "cache-key" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.insight).toBe("Cached insight.");
    });
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(1);
  });

  it("refresh re-fetches the insight", async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce({ text: "First insight." })
      .mockResolvedValueOnce({ text: "Refreshed insight." });

    const { result } = renderHook(
      () => usePageInsight({ context: "ctx", systemPrompt: "sys", cacheKey: "cache-key" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.insight).toBe("First insight.");
    });

    result.current.refresh();

    await waitFor(() => {
      expect(result.current.insight).toBe("Refreshed insight.");
    });
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(2);
  });
});

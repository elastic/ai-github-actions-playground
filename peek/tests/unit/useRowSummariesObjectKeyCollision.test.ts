// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { generateText } from "ai";

import { useRowSummaries } from "../../src/hooks/useRowSummaries";
import { useLLMStore } from "../../src/store/useLLMStore";
import { resetAllStores } from "../fixtures/test-utils";

vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn(() => ({ id: "test-model" }))),
}));
vi.stubGlobal(
  "IntersectionObserver",
  vi.fn(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() })),
);

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const COLUMNS = [{ name: "payload", type: "json" }];

describe("useRowSummaries object-key collision", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    vi.mocked(generateText).mockReset();
    useLLMStore.getState().setApiKey("sk-test-key");
  });

  it("does not reuse cached summary for a different object row", async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: JSON.stringify({ summaries: [{ rowIndex: 0, summary: "Summary A" }] }),
      } as Awaited<ReturnType<typeof generateText>>)
      .mockResolvedValueOnce({
        text: JSON.stringify({ summaries: [{ rowIndex: 0, summary: "Summary B" }] }),
      } as Awaited<ReturnType<typeof generateText>>);

    const { result, rerender } = renderHook(({ rows }) => useRowSummaries(COLUMNS, rows, true), {
      wrapper: createWrapper(),
      initialProps: { rows: [[{ a: 1 }]] as unknown[][] },
    });

    await waitFor(() => {
      expect(result.current.summaries.get(0)?.summary).toBe("Summary A");
    });
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(1);

    rerender({ rows: [[{ b: 2 }]] as unknown[][] });

    await waitFor(() => {
      expect(result.current.summaries.get(0)?.summary).toBe("Summary B");
    });
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(2);
  });

  it("does not reuse cached summary for a different array row", async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: JSON.stringify({ summaries: [{ rowIndex: 0, summary: "Array Summary A" }] }),
      } as Awaited<ReturnType<typeof generateText>>)
      .mockResolvedValueOnce({
        text: JSON.stringify({ summaries: [{ rowIndex: 0, summary: "Array Summary B" }] }),
      } as Awaited<ReturnType<typeof generateText>>);

    const { result, rerender } = renderHook(({ rows }) => useRowSummaries(COLUMNS, rows, true), {
      wrapper: createWrapper(),
      initialProps: { rows: [[[1, 2, 3]]] as unknown[][] },
    });

    await waitFor(() => {
      expect(result.current.summaries.get(0)?.summary).toBe("Array Summary A");
    });

    rerender({ rows: [[[4, 5, 6]]] as unknown[][] });

    await waitFor(() => {
      expect(result.current.summaries.get(0)?.summary).toBe("Array Summary B");
    });
  });
});

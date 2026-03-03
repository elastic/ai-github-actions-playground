// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
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

describe("usePageInsight – insightCache", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    clearInsightCache();
    useLLMStore.getState().setApiKey("sk-test-key");
    vi.mocked(generateText).mockReset();
  });

  it("clearInsightCache invalidates cached entries", async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce({ text: "Cached insight." })
      .mockResolvedValueOnce({ text: "Fresh insight." });

    const { result, unmount } = renderHook(() =>
      usePageInsight({ context: "ctx", systemPrompt: "sys", cacheKey: "cache-key" }),
    );

    await waitFor(() => {
      expect(result.current.insight).toBe("Cached insight.");
    });
    unmount();

    clearInsightCache();

    const { result: secondResult } = renderHook(() =>
      usePageInsight({ context: "ctx", systemPrompt: "sys", cacheKey: "cache-key" }),
    );

    await waitFor(() => {
      expect(secondResult.current.insight).toBe("Fresh insight.");
    });
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(2);
  });
});

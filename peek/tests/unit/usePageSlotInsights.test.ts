// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";

import { usePageSlotInsights } from "../../src/hooks/usePageSlotInsights";
import { useLLMStore } from "../../src/store/useLLMStore";
import { resetAllStores } from "../fixtures/test-utils";
import type { InsightSlotDefinition } from "../../src/types/insightSlots";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() =>
    Object.assign(
      vi.fn((model: string) => ({ id: model })),
      {
        chat: vi.fn((model: string) => ({ id: model })),
      },
    ),
  ),
}));

const SAMPLE_SLOTS: InsightSlotDefinition[] = [
  { slotId: "health-card", label: "Cluster health card" },
  { slotId: "index-count", label: "Index count stat" },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("usePageSlotInsights", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    useLLMStore.getState().setApiKey("sk-test-key");
    vi.mocked(generateObject).mockReset();
  });

  it("returns structured summary and insights from the LLM", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        summary: "Cluster looks healthy.",
        insights: [
          { slotId: "health-card", text: "All nodes green", severity: "info" },
          { slotId: "index-count", text: "42 indices" },
        ],
      },
    });

    const { result } = renderHook(
      () =>
        usePageSlotInsights({
          context: "cluster data here",
          systemPrompt: "You are an Elasticsearch expert.",
          cacheKey: "cluster-overview-slots::abc",
          slots: SAMPLE_SLOTS,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.summary).toBe("Cluster looks healthy.");
    });

    expect(result.current.insights).toHaveLength(2);
    expect(result.current.insights[0]!.slotId).toBe("health-card");
    expect(result.current.insights[0]!.text).toBe("All nodes green");
    expect(result.current.insights[1]!.slotId).toBe("index-count");
    expect(vi.mocked(generateObject)).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when no API key is configured", () => {
    useLLMStore.getState().setApiKey("");

    const { result } = renderHook(
      () =>
        usePageSlotInsights({
          context: "ctx",
          systemPrompt: "sys",
          cacheKey: "key",
          slots: SAMPLE_SLOTS,
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.summary).toBeNull();
    expect(result.current.insights).toEqual([]);
    expect(vi.mocked(generateObject)).not.toHaveBeenCalled();
  });

  it("does not fetch when slots are empty", () => {
    const { result } = renderHook(
      () =>
        usePageSlotInsights({
          context: "ctx",
          systemPrompt: "sys",
          cacheKey: "key",
          slots: [],
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.summary).toBeNull();
    expect(result.current.insights).toEqual([]);
    expect(vi.mocked(generateObject)).not.toHaveBeenCalled();
  });

  it("refresh re-fetches insights", async () => {
    vi.mocked(generateObject)
      .mockResolvedValueOnce({
        object: { summary: "First", insights: [] },
      })
      .mockResolvedValueOnce({
        object: { summary: "Refreshed", insights: [] },
      });

    const { result } = renderHook(
      () =>
        usePageSlotInsights({
          context: "ctx",
          systemPrompt: "sys",
          cacheKey: "refresh-test",
          slots: SAMPLE_SLOTS,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.summary).toBe("First");
    });

    result.current.refresh();

    await waitFor(() => {
      expect(result.current.summary).toBe("Refreshed");
    });
    expect(vi.mocked(generateObject)).toHaveBeenCalledTimes(2);
  });

  it("reports error when LLM call fails", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error("API limit reached"));

    const { result } = renderHook(
      () =>
        usePageSlotInsights({
          context: "ctx",
          systemPrompt: "sys",
          cacheKey: "error-test",
          slots: SAMPLE_SLOTS,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.error).toBe("API limit reached");
    });

    expect(result.current.summary).toBeNull();
    expect(result.current.insights).toEqual([]);
  });

  it("filters out insights for unknown slot ids", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        summary: "Cluster summary",
        insights: [
          { slotId: "health-card", text: "All nodes green", severity: "info" },
          { slotId: "unknown-slot", text: "Should be ignored", severity: "warning" },
        ],
      },
    });

    const { result } = renderHook(
      () =>
        usePageSlotInsights({
          context: "cluster data here",
          systemPrompt: "You are an Elasticsearch expert.",
          cacheKey: "cluster-overview-slots::abc",
          slots: SAMPLE_SLOTS,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.summary).toBe("Cluster summary");
    });

    expect(result.current.insights).toEqual([
      { slotId: "health-card", text: "All nodes green", severity: "info" },
    ]);
  });

  it("uses openrouter base URL when provider is openrouter", async () => {
    useLLMStore.getState().setProvider("openrouter");
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { summary: "OpenRouter summary", insights: [] },
    });

    const { result } = renderHook(
      () =>
        usePageSlotInsights({
          context: "ctx",
          systemPrompt: "sys",
          cacheKey: "openrouter",
          slots: SAMPLE_SLOTS,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.summary).toBe("OpenRouter summary");
    });

    expect(vi.mocked(createOpenAI)).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "https://openrouter.ai/api/v1" }),
    );
  });
});

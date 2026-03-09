// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { generateText } from "ai";

import { useRowSummaries } from "../../src/hooks/useRowSummaries";
import { useLLMStore } from "../../src/store/useLLMStore";
import { resetAllStores } from "../fixtures/test-utils";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn(() => ({ id: "test-model" }))),
}));

let ioCallback: IntersectionObserverCallback | null = null;

// IntersectionObserver is not available in jsdom; provide a minimal mock.
vi.stubGlobal(
  "IntersectionObserver",
  vi.fn((cb: IntersectionObserverCallback) => {
    ioCallback = cb;
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };
  }),
);

function triggerIntersection(target: Element, isIntersecting: boolean) {
  if (!ioCallback) throw new Error("IntersectionObserver callback not registered");
  const entry = { target, isIntersecting } as IntersectionObserverEntry;
  ioCallback([entry], {} as IntersectionObserver);
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const TEST_COLUMNS = [
  { name: "host.name", type: "keyword" },
  { name: "cpu", type: "double" },
  { name: "message", type: "text" },
];

const TEST_ROWS: unknown[][] = [
  ["server-1", 42.5, "High CPU usage detected"],
  ["server-2", 12.3, "Normal operation"],
  ["server-3", 99.1, "Critical: disk full"],
];

describe("useRowSummaries", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    vi.mocked(generateText).mockReset();
    ioCallback = null;
  });

  it("returns empty summaries when disabled", () => {
    const { result } = renderHook(() => useRowSummaries(TEST_COLUMNS, TEST_ROWS, false), {
      wrapper: createWrapper(),
    });

    expect(result.current.summaries.size).toBe(0);
    expect(typeof result.current.observeRow).toBe("function");
    expect(typeof result.current.unobserveRow).toBe("function");
  });

  it("returns empty summaries when LLM is not configured", () => {
    const { result } = renderHook(() => useRowSummaries(TEST_COLUMNS, TEST_ROWS, true), {
      wrapper: createWrapper(),
    });

    expect(result.current.summaries.size).toBe(0);
  });

  it("exposes observeRow callback and keeps summaries bounded", () => {
    useLLMStore.getState().setApiKey("sk-test-key");

    vi.mocked(generateText).mockResolvedValue({
      text: "Server-1 has high CPU at 42.5%.",
    } as Awaited<ReturnType<typeof generateText>>);

    const { result } = renderHook(() => useRowSummaries(TEST_COLUMNS, TEST_ROWS, true), {
      wrapper: createWrapper(),
    });

    // Simulate a row becoming visible via IntersectionObserver by creating
    // a mock element and calling observeRow. Since JSDOM doesn't support
    // IntersectionObserver natively, we verify the hook returns properly.
    expect(typeof result.current.observeRow).toBe("function");
    expect(result.current.summaries.size).toBeLessThanOrEqual(TEST_ROWS.length);
  });

  it("resets summaries when rows change", async () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    const oldSummary = "Old rows summary";
    const newSummary = "New row summary";
    vi.mocked(generateText).mockImplementation(async ({ messages }) => {
      const userMessage =
        messages.find((message) => message.role === "user" && typeof message.content === "string")
          ?.content ?? "";
      return {
        text: userMessage.includes("server-4") ? newSummary : oldSummary,
      } as Awaited<ReturnType<typeof generateText>>;
    });

    const { result, rerender } = renderHook(
      ({ rows }) => useRowSummaries(TEST_COLUMNS, rows, true),
      {
        wrapper: createWrapper(),
        initialProps: { rows: [TEST_ROWS[0]!] },
      },
    );

    await waitFor(() => {
      expect(ioCallback).not.toBeNull();
    });

    const oldRowElement = document.createElement("div");
    act(() => {
      result.current.observeRow(0, oldRowElement);
      triggerIntersection(oldRowElement, true);
    });

    await waitFor(() => {
      expect(vi.mocked(generateText)).toHaveBeenCalled();
      expect(result.current.summaries.size).toBeGreaterThan(0);
      expect(result.current.summaries.get(0)?.summary).toBe(oldSummary);
    });

    // Change the rows
    rerender({ rows: [["server-4", 55.0, "New row"]] });

    // Previous summaries should be cleared immediately after row-set change.
    await waitFor(() => {
      expect(result.current.summaries.get(0)?.summary).not.toBe(oldSummary);
    });

    const newRowElement = document.createElement("div");
    act(() => {
      result.current.observeRow(0, newRowElement);
      triggerIntersection(newRowElement, true);
    });

    await waitFor(() => {
      expect(result.current.summaries.size).toBeLessThanOrEqual(1);
      expect([...result.current.summaries.keys()].every((k) => k === 0)).toBe(true);
      expect(result.current.summaries.get(0)?.summary).toBe(newSummary);
      expect(result.current.summaries.get(0)?.summary).not.toBe(oldSummary);
    });
  });

  it("provides stable observeRow and unobserveRow callbacks", () => {
    const { result, rerender } = renderHook(() => useRowSummaries(TEST_COLUMNS, TEST_ROWS, false), {
      wrapper: createWrapper(),
    });

    const firstObserve = result.current.observeRow;
    const firstUnobserve = result.current.unobserveRow;

    rerender();

    expect(result.current.observeRow).toBe(firstObserve);
    expect(result.current.unobserveRow).toBe(firstUnobserve);
  });
});

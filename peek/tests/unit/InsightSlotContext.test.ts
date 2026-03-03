// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import {
  InsightSlotProvider,
  useSlotInsight,
  useInsightSlotContext,
} from "../../src/components/InsightSlotContext";
import type { SlotInsight } from "../../src/types/insightSlots";

const SAMPLE_INSIGHTS: SlotInsight[] = [
  { slotId: "health-card", text: "All nodes green", severity: "info" },
  { slotId: "index-count", text: "42 indices" },
];

function createWrapper(overrides?: Partial<React.ComponentProps<typeof InsightSlotProvider>>) {
  const props = {
    summary: "Page summary",
    insights: SAMPLE_INSIGHTS,
    loading: false,
    error: null,
    refresh: vi.fn(),
    ...overrides,
  };
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(InsightSlotProvider, props, children);
}

describe("InsightSlotContext", () => {
  describe("useSlotInsight", () => {
    it("returns the insight for a known slot", () => {
      const { result } = renderHook(() => useSlotInsight("health-card"), {
        wrapper: createWrapper(),
      });

      expect(result.current).toEqual({
        slotId: "health-card",
        text: "All nodes green",
        severity: "info",
      });
    });

    it("returns null for an unknown slot", () => {
      const { result } = renderHook(() => useSlotInsight("unknown-slot"), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeNull();
    });

    it("returns null when no provider is present", () => {
      const { result } = renderHook(() => useSlotInsight("health-card"));
      expect(result.current).toBeNull();
    });
  });

  describe("useInsightSlotContext", () => {
    it("exposes summary, loading, and error state", () => {
      const { result } = renderHook(() => useInsightSlotContext(), {
        wrapper: createWrapper({ loading: true, error: "oops" }),
      });

      expect(result.current.summary).toBe("Page summary");
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe("oops");
      expect(result.current.insightsBySlot.size).toBe(2);
    });

    it("refresh function is passed through", () => {
      const mockRefresh = vi.fn();
      const { result } = renderHook(() => useInsightSlotContext(), {
        wrapper: createWrapper({ refresh: mockRefresh }),
      });

      result.current.refresh();
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });
});

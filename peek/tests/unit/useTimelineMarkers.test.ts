// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { generateObject } from "ai";

import { useTimelineMarkers } from "../../src/components/investigate/useTimelineMarkers";
import { useLLMStore } from "../../src/store/useLLMStore";
import { resetAllStores } from "../fixtures/test-utils";
import type { TimelineEvent } from "../../src/components/investigate/investigateUtils";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn(() => ({ id: "test-model" }))),
}));

const SAMPLE_EVENTS: TimelineEvent[] = [
  {
    timestamp: "2026-03-01T10:00:00.000Z",
    category: "authentication",
    action: "logon",
    outcome: "success",
    userName: "admin",
    hostName: "web-server-01",
    sourceIp: "192.168.1.10",
    message: "User admin logged in",
    dataSource: "logs-security-default",
  },
  {
    timestamp: "2026-03-01T09:55:00.000Z",
    category: "authentication",
    action: "logon",
    outcome: "failure",
    userName: "admin",
    hostName: "web-server-01",
    sourceIp: "192.168.1.10",
    message: "Failed login attempt",
    dataSource: "auditbeat-2026.03.01",
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useTimelineMarkers", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    useLLMStore.getState().setApiKey("sk-test-key");
    vi.mocked(generateObject).mockReset();
  });

  it("returns structured markers from the LLM", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        markers: [
          {
            timestamp: "2026-03-01T09:55:00.000Z",
            label: "Failed login",
            description: "A failed login attempt was detected",
            severity: "warning",
          },
          {
            timestamp: "2026-03-01T10:00:00.000Z",
            label: "Successful logon",
            description: "User admin successfully authenticated",
            severity: "info",
          },
        ],
      },
    });

    const { result } = renderHook(
      () =>
        useTimelineMarkers({
          events: SAMPLE_EVENTS,
          activeTab: "user",
          searchedEntity: "admin",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.markers).toHaveLength(2);
    });

    expect(result.current.markers[0]!.label).toBe("Failed login");
    expect(result.current.markers[0]!.severity).toBe("warning");
    expect(result.current.markers[1]!.label).toBe("Successful logon");
    expect(vi.mocked(generateObject)).toHaveBeenCalledTimes(1);
  });

  it("returns empty markers when no API key is configured", () => {
    useLLMStore.getState().setApiKey("");

    const { result } = renderHook(
      () =>
        useTimelineMarkers({
          events: SAMPLE_EVENTS,
          activeTab: "user",
          searchedEntity: "admin",
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.markers).toEqual([]);
    expect(vi.mocked(generateObject)).not.toHaveBeenCalled();
  });

  it("returns empty markers when events are empty", () => {
    const { result } = renderHook(
      () =>
        useTimelineMarkers({
          events: [],
          activeTab: "user",
          searchedEntity: "admin",
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.markers).toEqual([]);
    expect(vi.mocked(generateObject)).not.toHaveBeenCalled();
  });
});

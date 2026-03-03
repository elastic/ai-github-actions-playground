import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { generateText } from "ai";

import PageInsightBanner from "../../src/components/PageInsightBanner";
import { useLLMStore } from "../../src/store/useLLMStore";
import { clearInsightCache } from "../../src/hooks/usePageInsight";
import { resetAllStores } from "../fixtures/test-utils";

vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "This is a test insight." }),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn()),
}));

describe("PageInsightBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAllStores();
    clearInsightCache();
    vi.mocked(generateText).mockReset();
    vi.mocked(generateText).mockResolvedValue({ text: "This is a test insight." });
  });

  it("renders nothing when no API key is configured", () => {
    render(
      <PageInsightBanner context="test context" systemPrompt="test prompt" cacheKey="test-key" />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows loading state then insight when API key is set", async () => {
    useLLMStore.getState().setApiKey("sk-test-key");

    render(
      <PageInsightBanner context="test context" systemPrompt="test prompt" cacheKey="test-key" />,
    );

    await waitFor(() => {
      expect(screen.getByText("This is a test insight.")).toBeInTheDocument();
    });
  });

  it("collapses to chip after dismiss and re-expands on click", async () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    const user = userEvent.setup();

    render(
      <PageInsightBanner
        context="test context"
        systemPrompt="test prompt"
        cacheKey="dismiss-key"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("This is a test insight.")).toBeInTheDocument();
    });

    // Dismiss the alert
    await user.click(screen.getByRole("button", { name: /dismiss insight/i }));

    // Should show collapsed chip
    expect(screen.getByText("AI insight available")).toBeInTheDocument();
    expect(screen.queryByText("This is a test insight.")).not.toBeInTheDocument();

    // Click chip to re-expand
    await user.click(screen.getByText("AI insight available"));

    await waitFor(() => {
      expect(screen.getByText("This is a test insight.")).toBeInTheDocument();
    });
  });

  it("refreshes insight after clicking refresh button", async () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    const user = userEvent.setup();
    vi.mocked(generateText)
      .mockResolvedValueOnce({ text: "Initial insight." })
      .mockResolvedValueOnce({ text: "Refreshed insight." });

    render(
      <PageInsightBanner
        context="test context"
        systemPrompt="test prompt"
        cacheKey="refresh-key"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Initial insight.")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /refresh insight/i }));

    await waitFor(() => {
      expect(screen.getByText("Refreshed insight.")).toBeInTheDocument();
    });
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(2);
  });
});

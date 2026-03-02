import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useLLMStore } from "../../src/store/useLLMStore";
import { resetAllStores } from "../fixtures/test-utils";
import QueryAnnotationOverlay from "../../src/components/QueryAnnotationOverlay";

// Mock the AI SDK to avoid real LLM calls
vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "Fetches recent logs sorted by time" }),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => (modelId: string) => modelId,
}));

describe("QueryAnnotationOverlay", () => {
  beforeEach(() => {
    resetAllStores();
    useLLMStore.getState().setApiKey("test-key");
    useLLMStore.getState().setProvider("openai");
    useLLMStore.getState().setModel("gpt-4");
  });

  it("reappears after focus→blur cycle for the same query", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <QueryAnnotationOverlay query="FROM logs-*" editorFocused={false} height={100} />,
    );

    // Wait for the LLM explanation to appear
    expect(await screen.findByText("Fetches recent logs sorted by time")).toBeInTheDocument();

    // Click overlay to dismiss
    await user.click(screen.getByRole("button", { name: /click to edit/i }));
    expect(screen.queryByText("Fetches recent logs sorted by time")).not.toBeInTheDocument();

    // Simulate editor gaining focus (user clicked editor)
    rerender(<QueryAnnotationOverlay query="FROM logs-*" editorFocused={true} height={100} />);

    // Simulate editor losing focus (user clicked elsewhere)
    rerender(<QueryAnnotationOverlay query="FROM logs-*" editorFocused={false} height={100} />);

    // The overlay should reappear for the same query
    expect(await screen.findByText("Fetches recent logs sorted by time")).toBeInTheDocument();
  });

  it("stays hidden while dismissed without a focus cycle", async () => {
    const user = userEvent.setup();
    render(<QueryAnnotationOverlay query="FROM logs-*" editorFocused={false} height={100} />);

    // Wait for the LLM explanation to appear
    expect(await screen.findByText("Fetches recent logs sorted by time")).toBeInTheDocument();

    // Click overlay to dismiss
    await user.click(screen.getByRole("button", { name: /click to edit/i }));
    expect(screen.queryByText("Fetches recent logs sorted by time")).not.toBeInTheDocument();
  });

  it("does not render when editor is focused", async () => {
    render(<QueryAnnotationOverlay query="FROM logs-*" editorFocused={true} height={100} />);

    // Even after waiting, the explanation should not appear
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByText("Fetches recent logs sorted by time")).not.toBeInTheDocument();
  });
});

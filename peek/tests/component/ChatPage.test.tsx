import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatPage from "../../src/components/ChatPage";
import { useLLMStore } from "../../src/store/useLLMStore";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import { makeStorageMock } from "../fixtures/test-utils";

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

describe("ChatPage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useLLMStore.getState().resetLLMState();
    useDashboardStore.getState().resetState();
  });

  it("shows unconfigured message when no API key is set", () => {
    render(<ChatPage />);
    expect(screen.getByText("LLM provider not configured")).toBeInTheDocument();
  });

  it("shows Go to Settings button when not configured", () => {
    render(<ChatPage />);
    expect(screen.getByRole("button", { name: /go to settings/i })).toBeInTheDocument();
  });

  it("renders chat UI when configured", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    render(<ChatPage />);
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Type a message…"),
    ).toBeInTheDocument();
  });

  it("shows empty state message when no messages", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    render(<ChatPage />);
    expect(
      screen.getByText("Start a conversation by typing a message below."),
    ).toBeInTheDocument();
  });

  it("renders existing messages", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    useLLMStore.getState().addMessage({ id: "1", role: "user", content: "Hello there" });
    useLLMStore.getState().addMessage({ id: "2", role: "assistant", content: "Hi! How can I help?" });
    render(<ChatPage />);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("Hi! How can I help?")).toBeInTheDocument();
  });

  it("has a send button", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    render(<ChatPage />);
    expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
  });

  it("has a clear button that is disabled when no messages", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    render(<ChatPage />);
    const clearButton = screen.getByRole("button", { name: /clear/i });
    expect(clearButton).toBeDisabled();
  });
});

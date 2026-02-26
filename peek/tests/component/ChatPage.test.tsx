import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

import ChatPage from "../../src/components/ChatPage";
import { useLLMStore } from "../../src/store/useLLMStore";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { makeStorageMock, resetAllStores } from "../fixtures/test-utils";

const { esQueryMock } = vi.hoisted(() => ({
  esQueryMock: vi.fn(),
}));

vi.stubGlobal("localStorage", makeStorageMock());
vi.stubGlobal("sessionStorage", makeStorageMock());

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
  tool: vi.fn((definition) => definition),
}));

vi.mock("../../src/services/es", () => ({
  ElasticsearchClient: vi.fn().mockImplementation(() => ({
    query: esQueryMock,
  })),
}));

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    esQueryMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    useLLMStore.getState().resetLLMState();
    useConnectionStore.getState().resetConnectionState();
    resetAllStores();

    const modelFactory = Object.assign((model: string) => ({ model, adapter: "responses" }), {
      chat: (model: string) => ({ model, adapter: "chat" }),
    });
    vi.mocked(createOpenAI).mockReturnValue(modelFactory as never);
  });

  function renderChat() {
    return render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
  }

  it("shows unconfigured message when no API key is set", () => {
    renderChat();
    expect(screen.getByText("LLM provider not configured")).toBeInTheDocument();
  });

  it("shows Go to Settings button when not configured", () => {
    renderChat();
    expect(screen.getByRole("button", { name: /go to settings/i })).toBeInTheDocument();
  });

  it("renders chat UI when configured", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    renderChat();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type a message…")).toBeInTheDocument();
  });

  it("shows empty state message when no messages", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    renderChat();
    expect(screen.getByText("Start a conversation by typing a message below.")).toBeInTheDocument();
  });

  it("renders existing messages", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    useLLMStore.getState().addMessage({ id: "1", role: "user", content: "Hello there" });
    useLLMStore
      .getState()
      .addMessage({ id: "2", role: "assistant", content: "Hi! How can I help?" });
    renderChat();
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("Hi! How can I help?")).toBeInTheDocument();
  });

  it("has a send button", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    renderChat();
    expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
  });

  it("has a clear button that is disabled when no messages", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    renderChat();
    const clearButton = screen.getByRole("button", { name: /clear/i });
    expect(clearButton).toBeDisabled();
  });

  it("sends a message and renders assistant reply", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    vi.mocked(generateText).mockResolvedValue({ text: "Assistant response" } as never);

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Help me write ES|QL");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText("Help me write ES|QL")).toBeInTheDocument();
      expect(screen.getByText("Assistant response")).toBeInTheDocument();
    });
  });

  it("shows error alert and does not persist error text in chat bubble", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    vi.mocked(generateText).mockRejectedValue(new Error("API down"));

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Hello");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText("API down")).toBeInTheDocument();
    });
    expect(screen.queryByText("Error: API down")).not.toBeInTheDocument();
  });

  it("uses chat-completions adapter for OpenRouter", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    useLLMStore.getState().setProvider("openrouter");
    vi.mocked(generateText).mockResolvedValue({ text: "ok" } as never);

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Hello");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.objectContaining({
            adapter: "chat",
          }),
        }),
      );
    });
  });

  it("clears messages and disables clear button", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    useLLMStore.getState().addMessage({ id: "msg-1", role: "user", content: "A message" });
    renderChat();

    const clearButton = screen.getByRole("button", { name: /clear/i });
    expect(clearButton).toBeEnabled();

    await user.click(clearButton);

    expect(useLLMStore.getState().messages).toEqual([]);
    expect(screen.getByRole("button", { name: /clear/i })).toBeDisabled();
  });

  it("registers run_esql_query tool that executes bounded ES|QL queries", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    useConnectionStore.getState().setConnection({ url: "http://localhost:9200", apiKey: "test" });
    vi.mocked(generateText).mockResolvedValue({ text: "Done" } as never);
    esQueryMock.mockResolvedValue({
      columns: [{ name: "message", type: "keyword" }],
      values: [["x".repeat(600)]],
      executionTimeMs: 12,
    });

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Run the query");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(generateText).toHaveBeenCalled();
    });

    const args = vi.mocked(generateText).mock.calls[0]?.[0] as {
      tools: {
        run_esql_query: { execute: (input: { query: string; rowLimit?: number }) => unknown };
      };
    };
    const result = (await args.tools.run_esql_query.execute({
      query: "FROM logs-*",
      rowLimit: 10,
    })) as {
      query: string;
      truncated: boolean;
      values: unknown[][];
    };

    expect(esQueryMock).toHaveBeenCalledWith(
      { query: "FROM logs-* | LIMIT 10" },
      expect.any(AbortSignal),
    );
    expect(result.query).toBe("FROM logs-* | LIMIT 10");
    expect(result.truncated).toBe(true);
    expect(String(result.values[0]?.[0] ?? "")).toContain("…");
  });
});

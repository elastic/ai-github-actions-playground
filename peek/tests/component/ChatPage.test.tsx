import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

import ChatPage from "../../src/components/ChatPage";
import { useLLMStore } from "../../src/store/useLLMStore";
import { useConnectionStore } from "../../src/store/useConnectionStore";
import { resetAllStores } from "../fixtures/test-utils";

const { buildChatRuntimeMock, getChatRequestTimeoutMsMock } = vi.hoisted(() => ({
  buildChatRuntimeMock: vi.fn(),
  getChatRequestTimeoutMsMock: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(),
}));

vi.mock("ai", () => ({
  streamText: vi.fn(),
  tool: vi.fn((definition) => definition),
}));

vi.mock("../../src/services/chatRuntime", () => ({
  buildChatRuntime: buildChatRuntimeMock,
  getChatRequestTimeoutMs: getChatRequestTimeoutMsMock,
}));

/** Create a mock streamText result with the given text content. */
function mockStreamResult(text: string) {
  return {
    fullStream: (async function* () {
      yield { type: "text-delta" as const, text };
    })(),
  };
}

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    useLLMStore.getState().resetLLMState();
    useConnectionStore.getState().resetConnectionState();
    resetAllStores();

    const modelFactory = Object.assign((model: string) => ({ model, adapter: "responses" }), {
      chat: (model: string) => ({ model, adapter: "chat" }),
    });
    vi.mocked(createOpenAI).mockReturnValue(modelFactory as never);

    getChatRequestTimeoutMsMock.mockReturnValue(15_000);
    buildChatRuntimeMock.mockResolvedValue({
      systemPrompt: "You are a helpful assistant.",
      tools: {},
      stopWhen: undefined,
    });
  });

  function renderChat(hideHeader = false) {
    return render(
      <MemoryRouter>
        <ChatPage hideHeader={hideHeader} />
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

  it("hides header when hideHeader is true and still shows input controls", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    renderChat(true);

    expect(screen.queryByText("Chat")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type a message…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
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

  it("disables send button when input is empty", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    renderChat();

    expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled();
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
    vi.mocked(streamText).mockReturnValue(mockStreamResult("Assistant response") as never);

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Help me");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText("Help me")).toBeInTheDocument();
      expect(screen.getByText("Assistant response")).toBeInTheDocument();
    });
  });

  it("disables send button while loading", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    let continueStream!: () => void;
    const continueAfterLoading = new Promise<void>((resolve) => {
      continueStream = resolve;
    });
    vi.mocked(streamText).mockReturnValue({
      fullStream: (async function* () {
        await continueAfterLoading;
        yield { type: "text-delta" as const, text: "done" };
      })(),
    } as never);

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Loading");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled();
    });

    continueStream();
    await waitFor(() => {
      expect(screen.getByText("done")).toBeInTheDocument();
    });
  });

  it("sends on Enter but not on Shift+Enter", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    vi.mocked(streamText).mockReturnValue(mockStreamResult("ok") as never);

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Hello");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(vi.mocked(streamText)).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(vi.mocked(streamText)).toHaveBeenCalledTimes(1);
    });
  });

  it("calls buildChatRuntime with connection, config, and pathname", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    useConnectionStore.getState().setConnection({ url: "http://localhost:9200", apiKey: "test" });
    vi.mocked(streamText).mockReturnValue(mockStreamResult("ok") as never);

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Hello");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(buildChatRuntimeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ apiKey: "sk-test-key" }),
          connection: expect.objectContaining({ url: "http://localhost:9200" }),
          pathname: "/",
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  it("passes runtime tools and systemPrompt to streamText", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");

    const mockTools = { search_docs: { description: "Search docs", execute: vi.fn() } };
    buildChatRuntimeMock.mockResolvedValue({
      systemPrompt: "Custom system prompt",
      tools: mockTools,
      stopWhen: undefined,
    });
    vi.mocked(streamText).mockReturnValue(mockStreamResult("ok") as never);

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Hello");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: "Custom system prompt",
          tools: mockTools,
        }),
      );
    });
  });

  it("passes stopWhen from runtime to streamText", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");

    const mockStopWhen = vi.fn();
    buildChatRuntimeMock.mockResolvedValue({
      systemPrompt: "You are a helpful assistant.",
      tools: {},
      stopWhen: mockStopWhen,
    });
    vi.mocked(streamText).mockReturnValue(mockStreamResult("ok") as never);

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Hello");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          stopWhen: mockStopWhen,
        }),
      );
    });
  });

  it("shows error alert and does not persist error text in chat bubble", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    vi.mocked(streamText).mockReturnValue({
      fullStream: {
        [Symbol.asyncIterator]() {
          return { next: () => Promise.reject(new Error("API down")) };
        },
      },
    } as never);

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Hello");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText("API down")).toBeInTheDocument();
    });
    expect(screen.queryByText("Error: API down")).not.toBeInTheDocument();
  });

  it("allows dismissing the error alert", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    vi.mocked(streamText).mockReturnValue({
      fullStream: {
        [Symbol.asyncIterator]() {
          return { next: () => Promise.reject(new Error("API down")) };
        },
      },
    } as never);

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Hello");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    const errorAlert = await screen.findByText("API down");
    expect(errorAlert).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => {
      expect(screen.queryByText("API down")).not.toBeInTheDocument();
    });
  });

  it("consumes pendingPrompt when configured and not loading", async () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    useLLMStore.getState().setPendingPrompt("Explain this");
    vi.mocked(streamText).mockReturnValue(mockStreamResult("Assistant response") as never);

    renderChat();

    await waitFor(() => {
      expect(vi.mocked(streamText)).toHaveBeenCalledTimes(1);
      expect(useLLMStore.getState().pendingPrompt).toBeNull();
    });
    expect(screen.getByText("Explain this")).toBeInTheDocument();
  });

  it("retains pendingPrompt while loading, then consumes it after loading clears", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    let continueFirstStream!: () => void;
    const continueAfterFirst = new Promise<void>((resolve) => {
      continueFirstStream = resolve;
    });
    vi.mocked(streamText)
      .mockReturnValueOnce({
        fullStream: (async function* () {
          await continueAfterFirst;
          yield { type: "text-delta" as const, text: "First done" };
        })(),
      } as never)
      .mockReturnValueOnce(mockStreamResult("Second done") as never);

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "First");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled();
    });

    useLLMStore.getState().setPendingPrompt("Second");
    expect(useLLMStore.getState().pendingPrompt).toBe("Second");
    expect(vi.mocked(streamText)).toHaveBeenCalledTimes(1);

    continueFirstStream();

    await waitFor(() => {
      expect(vi.mocked(streamText)).toHaveBeenCalledTimes(2);
      expect(useLLMStore.getState().pendingPrompt).toBeNull();
    });
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("uses chat-completions adapter for OpenRouter", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    useLLMStore.getState().setProvider("openrouter");
    vi.mocked(streamText).mockReturnValue(mockStreamResult("ok") as never);

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Hello");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(streamText).toHaveBeenCalledWith(
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

  it("uses timeout from getChatRequestTimeoutMs", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    vi.mocked(streamText).mockReturnValue(mockStreamResult("ok") as never);
    getChatRequestTimeoutMsMock.mockReturnValue(30_000);

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Hello");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(getChatRequestTimeoutMsMock).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: "sk-test-key" }),
      );
    });
  });

  it("renders assistant messages as Markdown", async () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    useLLMStore.getState().addMessage({ id: "1", role: "user", content: "Hello" });
    useLLMStore
      .getState()
      .addMessage({ id: "2", role: "assistant", content: "**bold text** and `code`" });
    renderChat();

    // Markdown should render a <strong> element for bold text
    const bold = screen.getByText("bold text");
    expect(bold.tagName).toBe("STRONG");

    // Inline code should be rendered in a <code> element
    const code = screen.getByText("code");
    expect(code.tagName).toBe("CODE");
  });

  it("shows tool call activity during streaming", async () => {
    const user = userEvent.setup();
    useLLMStore.getState().setApiKey("sk-test-key");
    let continueStream!: () => void;
    const continueAfterToolCall = new Promise<void>((resolve) => {
      continueStream = resolve;
    });

    // Create a stream that yields a tool-call, tool-result, then text
    vi.mocked(streamText).mockReturnValue({
      fullStream: (async function* () {
        yield {
          type: "tool-call" as const,
          toolCallId: "tc-1",
          toolName: "run_esql_query",
          args: { query: "FROM metrics" },
        };
        await continueAfterToolCall;
        yield {
          type: "tool-result" as const,
          toolCallId: "tc-1",
          toolName: "run_esql_query",
          output: { rowCount: 42 },
        };
        yield { type: "text-delta" as const, text: "Found some results" };
      })(),
    } as never);

    renderChat();

    await user.type(screen.getByPlaceholderText("Type a message…"), "Run query");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/Running query/)).toBeInTheDocument();
    });

    continueStream();

    await waitFor(() => {
      expect(screen.getByText(/42 rows/i)).toBeInTheDocument();
      expect(screen.getByText("Found some results")).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useLLMStore } from "../../src/store/useLLMStore";
import { makeStorageMock } from "../fixtures/test-utils";

const localStorageMock = makeStorageMock();
const sessionStorageMock = makeStorageMock();

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("sessionStorage", sessionStorageMock);

describe("useLLMStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    useLLMStore.getState().resetLLMState();
  });

  it("has correct default state", () => {
    const state = useLLMStore.getState();
    expect(state.config.provider).toBe("openai");
    expect(state.config.apiKey).toBe("");
    expect(state.config.model).toBe("gpt-4o-mini");
    expect(state.messages).toEqual([]);
  });

  it("isConfigured returns false when API key is empty", () => {
    expect(useLLMStore.getState().isConfigured()).toBe(false);
  });

  it("isConfigured returns true when API key is set", () => {
    useLLMStore.getState().setApiKey("sk-test-key");
    expect(useLLMStore.getState().isConfigured()).toBe(true);
  });

  it("isConfigured returns false when API key is whitespace", () => {
    useLLMStore.getState().setApiKey("   ");
    expect(useLLMStore.getState().isConfigured()).toBe(false);
  });

  it("setProvider updates the provider", () => {
    useLLMStore.getState().setProvider("openai");
    expect(useLLMStore.getState().config.provider).toBe("openai");
  });

  it("setApiKey updates the API key", () => {
    useLLMStore.getState().setApiKey("sk-abc123");
    expect(useLLMStore.getState().config.apiKey).toBe("sk-abc123");
  });

  it("setModel updates the model", () => {
    useLLMStore.getState().setModel("gpt-4o");
    expect(useLLMStore.getState().config.model).toBe("gpt-4o");
  });

  it("addMessage appends a message", () => {
    useLLMStore.getState().addMessage({
      id: "msg-1",
      role: "user",
      content: "Hello",
    });
    const messages = useLLMStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Hello");
  });

  it("updateMessage updates an existing message", () => {
    useLLMStore.getState().addMessage({
      id: "msg-1",
      role: "assistant",
      content: "",
    });
    useLLMStore.getState().updateMessage("msg-1", "Updated content");
    expect(useLLMStore.getState().messages[0].content).toBe("Updated content");
  });

  it("updateMessage does not affect other messages", () => {
    useLLMStore.getState().addMessage({ id: "msg-1", role: "user", content: "First" });
    useLLMStore.getState().addMessage({ id: "msg-2", role: "assistant", content: "Second" });
    useLLMStore.getState().updateMessage("msg-2", "Updated");
    expect(useLLMStore.getState().messages[0].content).toBe("First");
    expect(useLLMStore.getState().messages[1].content).toBe("Updated");
  });

  it("clearMessages removes all messages", () => {
    useLLMStore.getState().addMessage({ id: "msg-1", role: "user", content: "Hello" });
    useLLMStore.getState().addMessage({ id: "msg-2", role: "assistant", content: "Hi" });
    useLLMStore.getState().clearMessages();
    expect(useLLMStore.getState().messages).toEqual([]);
  });

  it("resetLLMState resets all state to defaults", () => {
    useLLMStore.getState().setApiKey("sk-test");
    useLLMStore.getState().setModel("gpt-4o");
    useLLMStore.getState().addMessage({ id: "msg-1", role: "user", content: "Test" });

    useLLMStore.getState().resetLLMState();

    const state = useLLMStore.getState();
    expect(state.config.apiKey).toBe("");
    expect(state.config.model).toBe("gpt-4o-mini");
    expect(state.config.provider).toBe("openai");
    expect(state.messages).toEqual([]);
  });
});

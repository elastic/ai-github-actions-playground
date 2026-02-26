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
    expect(state.config.tabAutocompleteEnabled).toBe(false);
    expect(state.config.elasticDocsEnabled).toBe(false);
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
    const initial = useLLMStore.getState().config.provider;
    const newProvider = initial === "openai" ? "openrouter" : "openai";
    useLLMStore.getState().setProvider(newProvider);
    expect(useLLMStore.getState().config.provider).toBe(newProvider);
  });

  it("setProvider switches to openrouter and applies provider default model", () => {
    useLLMStore.getState().setProvider("openrouter");
    expect(useLLMStore.getState().config.provider).toBe("openrouter");
    expect(useLLMStore.getState().config.model).toBe("openai/gpt-4o-mini");
  });

  it("setApiKey updates the API key", () => {
    useLLMStore.getState().setApiKey("sk-abc123");
    expect(useLLMStore.getState().config.apiKey).toBe("sk-abc123");
  });

  it("setModel updates the model", () => {
    useLLMStore.getState().setModel("gpt-4o");
    expect(useLLMStore.getState().config.model).toBe("gpt-4o");
  });

  it("setTabAutocompleteEnabled updates the autocomplete toggle", () => {
    useLLMStore.getState().setTabAutocompleteEnabled(true);
    expect(useLLMStore.getState().config.tabAutocompleteEnabled).toBe(true);
  });

  it("setTabAutocompleteEnabled can disable the autocomplete toggle", () => {
    useLLMStore.getState().setTabAutocompleteEnabled(true);
    useLLMStore.getState().setTabAutocompleteEnabled(false);
    expect(useLLMStore.getState().config.tabAutocompleteEnabled).toBe(false);
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

  it("removeMessage removes one message by id", () => {
    useLLMStore.getState().addMessage({ id: "msg-1", role: "user", content: "First" });
    useLLMStore.getState().addMessage({ id: "msg-2", role: "assistant", content: "Second" });
    useLLMStore.getState().removeMessage("msg-1");
    expect(useLLMStore.getState().messages).toEqual([
      { id: "msg-2", role: "assistant", content: "Second" },
    ]);
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
    useLLMStore.getState().setElasticDocsEnabled(true);
    useLLMStore.getState().addMessage({ id: "msg-1", role: "user", content: "Test" });

    useLLMStore.getState().resetLLMState();

    const state = useLLMStore.getState();
    expect(state.config.apiKey).toBe("");
    expect(state.config.model).toBe("gpt-4o-mini");
    expect(state.config.provider).toBe("openai");
    expect(state.config.tabAutocompleteEnabled).toBe(false);
    expect(state.config.elasticDocsEnabled).toBe(false);
    expect(state.messages).toEqual([]);
  });

  it("setElasticDocsEnabled updates the elastic docs toggle", () => {
    useLLMStore.getState().setElasticDocsEnabled(true);
    expect(useLLMStore.getState().config.elasticDocsEnabled).toBe(true);
  });

  it("setElasticDocsEnabled can disable the elastic docs toggle", () => {
    useLLMStore.getState().setElasticDocsEnabled(true);
    useLLMStore.getState().setElasticDocsEnabled(false);
    expect(useLLMStore.getState().config.elasticDocsEnabled).toBe(false);
  });
});

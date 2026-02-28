import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createSplitSecretStorage } from "./createSplitSecretStorage";

export type LLMProvider = "openai" | "openrouter";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  tabAutocompleteEnabled: boolean;
  elasticDocsEnabled: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface LLMState {
  config: LLMConfig;
  messages: ChatMessage[];

  setProvider: (provider: LLMProvider) => void;
  setApiKey: (apiKey: string) => void;
  setModel: (model: string) => void;
  setTabAutocompleteEnabled: (enabled: boolean) => void;
  setElasticDocsEnabled: (enabled: boolean) => void;
  isConfigured: () => boolean;

  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, content: string) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  resetLLMConfig: () => void;
  resetLLMState: () => void;
}

const DEFAULT_CONFIG: LLMConfig = {
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
  tabAutocompleteEnabled: false,
  elasticDocsEnabled: false,
};

const DEFAULT_MODEL_BY_PROVIDER: Record<LLMProvider, string> = {
  openai: "gpt-4o-mini",
  openrouter: "openai/gpt-4o-mini",
};

const LLM_API_KEY_SESSION_KEY = "elastic-peek-llm:apiKey";

/**
 * Custom storage that keeps the LLM provider/model in localStorage (persistent)
 * while storing the API key only in sessionStorage (cleared when the browser
 * session ends, reducing the exposure window of the credential).
 */
type PersistedLLMState = { config?: LLMConfig };

const llmSplitStorage = createSplitSecretStorage<PersistedLLMState>({
  restoreSecrets: (_name, state) => {
    const apiKey = sessionStorage.getItem(LLM_API_KEY_SESSION_KEY) ?? "";
    if (state.config) {
      return { ...state, config: { ...state.config, apiKey } };
    }
    return state;
  },
  persistSecrets: (_name, state) => {
    sessionStorage.setItem(LLM_API_KEY_SESSION_KEY, state.config?.apiKey ?? "");
  },
  stripSecrets: (state) => ({
    ...state,
    config: state.config ? { ...state.config, apiKey: "" } : state.config,
  }),
  clearSecrets: () => {
    sessionStorage.removeItem(LLM_API_KEY_SESSION_KEY);
  },
});

export const useLLMStore = create<LLMState>()(
  persist(
    (set, get) => ({
      config: { ...DEFAULT_CONFIG },
      messages: [],

      setProvider: (provider) =>
        set((s) => ({
          config: {
            ...s.config,
            provider,
            model: DEFAULT_MODEL_BY_PROVIDER[provider],
          },
        })),
      setApiKey: (apiKey) => set((s) => ({ config: { ...s.config, apiKey } })),
      setModel: (model) => set((s) => ({ config: { ...s.config, model } })),
      setTabAutocompleteEnabled: (enabled) =>
        set((s) => ({ config: { ...s.config, tabAutocompleteEnabled: enabled } })),
      setElasticDocsEnabled: (enabled) =>
        set((s) => ({ config: { ...s.config, elasticDocsEnabled: enabled } })),
      isConfigured: () => {
        const { config } = get();
        return config.apiKey.trim().length > 0;
      },

      addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
      updateMessage: (id, content) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? { ...m, content } : m)),
        })),
      removeMessage: (id) =>
        set((s) => ({
          messages: s.messages.filter((m) => m.id !== id),
        })),
      clearMessages: () => set({ messages: [] }),
      resetLLMConfig: () => {
        useLLMStore.persist.clearStorage();
        set({
          config: { ...DEFAULT_CONFIG },
        });
      },
      resetLLMState: () => {
        useLLMStore.persist.clearStorage();
        set({
          config: { ...DEFAULT_CONFIG },
          messages: [],
        });
      },
    }),
    {
      name: "elastic-peek-llm",
      storage: llmSplitStorage,
      partialize: (state) => ({
        config: state.config,
      }),
    },
  ),
);

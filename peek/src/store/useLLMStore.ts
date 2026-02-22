import { create } from "zustand";
import { persist, type StorageValue } from "zustand/middleware";

export type LLMProvider = "openai";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
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
  isConfigured: () => boolean;

  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, content: string) => void;
  clearMessages: () => void;
  resetLLMState: () => void;
}

const DEFAULT_CONFIG: LLMConfig = {
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
};

const LLM_API_KEY_SESSION_KEY = "elastic-peek-llm:apiKey";

/**
 * Custom storage that keeps the LLM provider/model in localStorage (persistent)
 * while storing the API key only in sessionStorage (cleared when the browser
 * session ends, reducing the exposure window of the credential).
 */
type PersistedLLMState = { config?: LLMConfig };

const llmSplitStorage = {
  getItem: (name: string): StorageValue<PersistedLLMState> | null => {
    const localRaw = localStorage.getItem(name);
    if (!localRaw) return null;
    try {
      const stored = JSON.parse(localRaw) as StorageValue<PersistedLLMState>;
      const apiKey = sessionStorage.getItem(LLM_API_KEY_SESSION_KEY) ?? "";
      if (stored.state.config) {
        stored.state.config = { ...stored.state.config, apiKey };
      }
      return stored;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: StorageValue<PersistedLLMState>): void => {
    const apiKey = value.state.config?.apiKey ?? "";
    const toStore: StorageValue<PersistedLLMState> = {
      ...value,
      state: {
        ...value.state,
        config: value.state.config ? { ...value.state.config, apiKey: "" } : value.state.config,
      },
    };
    localStorage.setItem(name, JSON.stringify(toStore));
    sessionStorage.setItem(LLM_API_KEY_SESSION_KEY, apiKey);
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
    sessionStorage.removeItem(LLM_API_KEY_SESSION_KEY);
  },
};

export const useLLMStore = create<LLMState>()(
  persist(
    (set, get) => ({
      config: { ...DEFAULT_CONFIG },
      messages: [],

      setProvider: (provider) => set((s) => ({ config: { ...s.config, provider } })),
      setApiKey: (apiKey) => set((s) => ({ config: { ...s.config, apiKey } })),
      setModel: (model) => set((s) => ({ config: { ...s.config, model } })),
      isConfigured: () => {
        const { config } = get();
        return config.apiKey.trim().length > 0;
      },

      addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
      updateMessage: (id, content) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? { ...m, content } : m)),
        })),
      clearMessages: () => set({ messages: [] }),
      resetLLMState: () => {
        llmSplitStorage.removeItem("elastic-peek-llm");
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

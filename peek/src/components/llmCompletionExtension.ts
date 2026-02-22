import { inlineCopilot } from "codemirror-copilot";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { Extension } from "@codemirror/state";

import { useLLMStore } from "../store/useLLMStore";

interface LLMCompletionOptions {
  /** System prompt giving the LLM domain context (e.g. "You are an ES|QL expert…") */
  prompt: string;
  /** Debounce delay in ms before requesting a completion (default: 500) */
  delay?: number;
}

/**
 * CodeMirror extension that provides inline ghost-text completions
 * powered by the user's configured LLM provider.
 *
 * Each editor supplies its own system prompt so completions are
 * domain-aware (ES|QL, JSON, etc.). The extension reads LLM config
 * from useLLMStore at call time, so toggling the feature or changing
 * the API key takes effect immediately.
 */
export function makeLLMCompletionExtension(options: LLMCompletionOptions): Extension {
  return inlineCopilot(async (prefix, suffix) => {
    const { config } = useLLMStore.getState();
    if (!config.tabAutocompleteEnabled || !config.apiKey.trim()) {
      return "";
    }

    const openai = createOpenAI({
      apiKey: config.apiKey,
      ...(config.provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
    });
    const model =
      config.provider === "openrouter" ? openai.chat(config.model) : openai(config.model);

    const result = await generateText({
      model,
      system: options.prompt,
      messages: [
        {
          role: "user",
          content:
            `Complete the code at the cursor position.\n` +
            `Text before cursor:\n${prefix}\n` +
            `Text after cursor:\n${suffix}\n` +
            `Output only the completion text, nothing else.`,
        },
      ],
    });

    return result.text.trim();
  }, options.delay ?? 500);
}

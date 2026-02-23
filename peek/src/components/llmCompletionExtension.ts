import { inlineCopilot } from "codemirror-copilot";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { ViewPlugin, type ViewUpdate } from "@codemirror/view";

import { useLLMStore } from "../store/useLLMStore";

import { ESQL_SYNTAX_GUIDE } from "./esqlSyntaxGuide";

export { ESQL_SYNTAX_GUIDE };

// ---------------------------------------------------------------------------
// Recent-edits StateField — tracks the last few deletions so the LLM knows
// what the user just removed.
// ---------------------------------------------------------------------------

interface RecentEdit {
  deleted: string;
  pos: number;
}

const MAX_RECENT_EDITS = 5;

const resetRecentEditsEffect = StateEffect.define<null>();

export const recentEditsField = StateField.define<RecentEdit[]>({
  create() {
    return [];
  },
  update(edits, tr) {
    for (const effect of tr.effects) {
      if (effect.is(resetRecentEditsEffect)) return [];
    }
    if (!tr.docChanged) return edits;
    const newEdits: RecentEdit[] = [];
    tr.changes.iterChanges((fromA, toA) => {
      if (toA > fromA) {
        const deleted = tr.startState.sliceDoc(fromA, toA);
        if (deleted.trim()) {
          newEdits.push({ deleted, pos: fromA });
        }
      }
    });
    if (newEdits.length === 0) return edits;
    return [...edits, ...newEdits].slice(-MAX_RECENT_EDITS);
  },
});

// ---------------------------------------------------------------------------
// Query-error side channel — pages set this after a failed ES|QL run so the
// completion extension can suggest fixes.
// ---------------------------------------------------------------------------

let lastQueryError: string | null = null;

/** Call from page components after a query fails. */
export function setLastQueryError(error: string | null) {
  lastQueryError = error;
}

/** Read the last query error (used internally by the extension). */
export function getLastQueryError(): string | null {
  return lastQueryError;
}

// ---------------------------------------------------------------------------
// Extension factory
// ---------------------------------------------------------------------------

interface LLMCompletionOptions {
  /** System prompt giving the LLM domain context (e.g. "You are an ES|QL expert…") */
  prompt: string;
  /** Debounce delay in ms before requesting a completion (default: 500) */
  delay?: number;
  /** Whether to include the ES|QL syntax guide in the prompt */
  esqlGuide?: boolean;
}

/**
 * CodeMirror extension that provides inline ghost-text completions
 * powered by the user's configured LLM provider.
 *
 * Each editor supplies its own system prompt so completions are
 * domain-aware (ES|QL, JSON, etc.). The extension reads LLM config
 * from useLLMStore at call time, so toggling the feature or changing
 * the API key takes effect immediately.
 *
 * Enhancements:
 * - Includes recent deletions in the prompt so the LLM can suggest replacements
 * - Includes the last query error so the LLM can suggest fixes
 * - Optionally includes an ES|QL syntax guide for language-aware completions
 */
export function makeLLMCompletionExtension(options: LLMCompletionOptions): Extension {
  const systemPrompt = options.esqlGuide
    ? `${options.prompt}\n\n${ESQL_SYNTAX_GUIDE}`
    : options.prompt;

  // Closure variable synced from the StateField by the ViewPlugin below.
  // This lets us access per-editor recent edits from the inlineCopilot
  // callback which only receives (prefix, suffix).
  let currentEdits: RecentEdit[] = [];

  const syncPlugin = ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        currentEdits = update.state.field(recentEditsField, false) ?? [];
        // Clear recent edits when a completion is accepted
        if (update.transactions.some((tr) => tr.isUserEvent("input.complete"))) {
          update.view.dispatch({
            effects: resetRecentEditsEffect.of(null),
          });
        }
      }
    },
  );

  const fetchCompletion = async (prefix: string, suffix: string): Promise<string> => {
    const { config } = useLLMStore.getState();
    if (!config.tabAutocompleteEnabled || !config.apiKey.trim()) {
      return "";
    }

    // Build context sections
    const contextParts: string[] = [];

    // Recent deletions
    if (currentEdits.length > 0) {
      const editLines = currentEdits.map((e) => `  - Deleted: "${e.deleted}"`).join("\n");
      contextParts.push(`Recent edits:\n${editLines}`);
    }

    // Last query error
    const queryError = getLastQueryError();
    if (queryError) {
      contextParts.push(`Last query error:\n  ${queryError}`);
    }

    const contextSection = contextParts.length > 0 ? `\n\n${contextParts.join("\n\n")}` : "";

    const openai = createOpenAI({
      apiKey: config.apiKey,
      ...(config.provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
    });
    const model =
      config.provider === "openrouter" ? openai.chat(config.model) : openai(config.model);

    const result = await generateText({
      model,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            `Complete the code at the cursor position.\n` +
            `Text before cursor:\n${prefix}\n` +
            `Text after cursor:\n${suffix}` +
            contextSection +
            `\n\nIMPORTANT: The user may type plain language descriptions as pseudo-code ` +
            `(e.g. "count events by host", "filter where status > 400", "sort by timestamp descending"). ` +
            `When the text before the cursor ends with natural language rather than valid syntax, ` +
            `treat it as the user's intent and complete with the proper implementation. ` +
            `Output only the completion text, nothing else.`,
        },
      ],
    });

    return result.text.trim();
  };

  return [recentEditsField, syncPlugin, ...inlineCopilot(fetchCompletion, options.delay ?? 500)];
}

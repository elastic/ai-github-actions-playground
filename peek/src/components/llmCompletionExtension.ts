import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

import { useLLMStore } from "../store/useLLMStore";

import { ESQL_SYNTAX_GUIDE } from "./esqlSyntaxGuide";
import { ghostDiffExtension, setSuggestion } from "./ghostDiffExtension";
import { detectNaturalLanguage, type NLChunk } from "./nlDetector";

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
// Per-editor query error store — keyed by EditorView so each editor tracks
// its own last query error independently.
// ---------------------------------------------------------------------------

const queryErrorMap = new WeakMap<EditorView, string | null>();

/** Set the last query error for a specific editor view. */
export function setLastQueryError(error: string | null, view?: EditorView) {
  if (view) {
    queryErrorMap.set(view, error);
  } else {
    // Fallback: set on all tracked views (for callers that don't have a view ref)
    globalLastQueryError = error;
  }
}

/** Read the last query error for a specific editor view. */
export function getLastQueryError(view?: EditorView): string | null {
  if (view) {
    return queryErrorMap.get(view) ?? globalLastQueryError;
  }
  return globalLastQueryError;
}

// Global fallback for callers (like useEsqlQuery) that don't have a view reference
let globalLastQueryError: string | null = null;

// ---------------------------------------------------------------------------
// OpenAI client cache — avoids recreating clients on every completion request
// ---------------------------------------------------------------------------

const clientCache = new Map<string, ReturnType<typeof createOpenAI>>();

function getOrCreateClient(apiKey: string, provider: string) {
  const cacheKey = `${apiKey}|${provider}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = createOpenAI({
      apiKey,
      ...(provider === "openrouter" ? { baseURL: "https://openrouter.ai/api/v1" } : {}),
    });
    clientCache.set(cacheKey, client);
  }
  return client;
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
 * Shows a "ghost diff" preview: strikethrough on natural language text
 * with green ghost text for the ES|QL replacement. Tab accepts, Escape
 * dismisses, typing clears.
 *
 * Each editor supplies its own system prompt so completions are
 * domain-aware (ES|QL, JSON, etc.). The extension reads LLM config
 * from useLLMStore at call time, so toggling the feature or changing
 * the API key takes effect immediately.
 *
 * Enhancements:
 * - Detects natural language mid-query and suggests ES|QL replacements
 * - Includes recent deletions in the prompt so the LLM can suggest replacements
 * - Includes the last query error so the LLM can suggest fixes
 * - Optionally includes an ES|QL syntax guide for language-aware completions
 */
export function makeLLMCompletionExtension(options: LLMCompletionOptions): Extension {
  const systemPrompt = options.esqlGuide
    ? `${options.prompt}\n\n${ESQL_SYNTAX_GUIDE}`
    : options.prompt;

  const delay = options.delay ?? 500;

  // Closure variables synced from the StateField/view by the ViewPlugin below.
  let currentEdits: RecentEdit[] = [];
  let currentView: EditorView | null = null;

  // ---------------------------------------------------------------------------
  // Context builder — assembles recent edits + query error into prompt context
  // ---------------------------------------------------------------------------

  function buildContextSection(): string {
    const contextParts: string[] = [];

    if (currentEdits.length > 0) {
      const editLines = currentEdits.map((e) => `  - Deleted: "${e.deleted}"`).join("\n");
      contextParts.push(`Recent edits:\n${editLines}`);
    }

    const queryError = getLastQueryError(currentView ?? undefined);
    if (queryError) {
      contextParts.push(`Last query error:\n  ${queryError}`);
    }

    return contextParts.length > 0 ? `\n\n${contextParts.join("\n\n")}` : "";
  }

  // ---------------------------------------------------------------------------
  // fetchCompletion — calls the LLM with the appropriate prompt
  // ---------------------------------------------------------------------------

  async function fetchCompletion(
    prefix: string,
    suffix: string,
    nlChunk: NLChunk | null,
  ): Promise<string> {
    const { config } = useLLMStore.getState();
    if (!config.tabAutocompleteEnabled || !config.apiKey.trim()) {
      return "";
    }

    const contextSection = buildContextSection();

    let userMessage: string;
    if (nlChunk) {
      userMessage =
        `The user typed natural language in their ES|QL query. ` +
        `Translate the natural language into valid ES|QL syntax.\n\n` +
        `Full query:\n${prefix}${suffix}\n\n` +
        `Natural language to translate: "${nlChunk.text}"\n\n` +
        `Return ONLY the ES|QL replacement for the natural language portion. ` +
        `Do not include surrounding query text. No explanation.` +
        contextSection;
    } else {
      userMessage =
        `Complete the code at the cursor position.\n` +
        `Text before cursor:\n${prefix}\n` +
        `Text after cursor:\n${suffix}` +
        contextSection +
        `\n\nIMPORTANT: The user may type plain language descriptions as pseudo-code ` +
        `(e.g. "count events by host", "filter where status > 400", "sort by timestamp descending"). ` +
        `When the text before the cursor ends with natural language rather than valid syntax, ` +
        `treat it as the user's intent and complete with the proper implementation. ` +
        `Output only the completion text, nothing else.`;
    }

    try {
      const openai = getOrCreateClient(config.apiKey, config.provider);
      const model =
        config.provider === "openrouter" ? openai.chat(config.model) : openai(config.model);

      const result = await generateText({
        model,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      return result.text.trim();
    } catch (err) {
      console.error("LLM completion failed:", err);
      return "";
    }
  }

  // ---------------------------------------------------------------------------
  // Completion trigger plugin — debounces, detects NL, calls LLM, dispatches
  // ---------------------------------------------------------------------------

  let generationId = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const completionPlugin = ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        currentView = view;
      }

      update(update: ViewUpdate) {
        currentView = update.view;
        currentEdits = update.state.field(recentEditsField, false) ?? [];

        // Clear recent edits when a completion is accepted
        if (update.transactions.some((tr) => tr.isUserEvent("input.complete"))) {
          update.view.dispatch({
            effects: resetRecentEditsEffect.of(null),
          });
        }

        if (!update.docChanged) return;

        // Cancel pending debounce
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer);
        }

        const view = update.view;
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          void triggerCompletion(view);
        }, delay);
      }

      destroy() {
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
      }
    },
  );

  async function triggerCompletion(view: EditorView) {
    const { config } = useLLMStore.getState();
    if (!config.tabAutocompleteEnabled || !config.apiKey.trim()) return;

    const state = view.state;
    const cursor = state.selection.main.head;
    const docText = state.doc.toString();

    // Increment generation so stale responses are ignored
    const myGeneration = ++generationId;

    // Detect NL chunk (only for ES|QL editors with the guide enabled)
    const nlChunk = options.esqlGuide ? detectNaturalLanguage(docText, cursor) : null;

    const prefix = docText.slice(0, cursor);
    const suffix = docText.slice(cursor);
    const completionText = await fetchCompletion(prefix, suffix, nlChunk);

    // Discard if a newer request has been started
    if (generationId !== myGeneration) return;
    if (!completionText) return;

    if (nlChunk) {
      // Replace mode: strikethrough the NL chunk, ghost the ES|QL
      view.dispatch({
        effects: setSuggestion.of({
          from: nlChunk.from,
          to: nlChunk.to,
          replacement: completionText,
        }),
      });
    } else {
      // Append mode: ghost text at cursor
      view.dispatch({
        effects: setSuggestion.of({
          from: cursor,
          to: cursor,
          replacement: completionText,
        }),
      });
    }
  }

  return [recentEditsField, ghostDiffExtension, completionPlugin];
}

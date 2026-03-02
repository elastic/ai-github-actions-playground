import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { setDiagnostics, type Diagnostic } from "@codemirror/lint";

import { useLLMStore } from "../store/useLLMStore";

import { ESQL_SYNTAX_GUIDE } from "./esqlSyntaxGuide";
import { ghostDiffExtension, setSuggestion } from "./ghostDiffExtension";

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

/**
 * Parse an ES|QL error message for a "line X:Y:" position marker.
 * Returns the document offset range and the message text after the marker.
 * @internal exported for testing
 */
export function parseEsqlErrorPosition(
  error: string,
  doc: {
    lines: number;
    line(n: number): { from: number; to: number; text: string; length: number };
  },
): { from: number; to: number; message: string } | null {
  const match = error.match(/line (\d+):(\d+):\s*([\s\S]*)/);
  if (!match) return null;
  const line = parseInt(match[1]!, 10);
  const col = parseInt(match[2]!, 10);
  const message = match[3]?.trim() || error;
  if (line < 1 || line > doc.lines) return null;
  const lineInfo = doc.line(line);
  const from = lineInfo.from + Math.min(col, lineInfo.length);
  let to = from;
  while (to < lineInfo.to && /\S/.test(lineInfo.text[to - lineInfo.from] ?? "")) {
    to++;
  }
  if (to === from) to = Math.min(from + 1, lineInfo.to);
  return { from, to, message };
}

/** Set the last query error for a specific editor view and update inline diagnostics. */
export function setLastQueryError(error: string | null, view: EditorView) {
  queryErrorMap.set(view, error);

  // Dispatch inline lint diagnostics so the editor shows squiggly underlines.
  // Silently skip if the view doesn't have a valid state (e.g. destroyed or in tests).
  try {
    const diagnostics: Diagnostic[] = [];
    if (error) {
      const parsed = parseEsqlErrorPosition(error, view.state.doc);
      if (parsed) {
        diagnostics.push({
          from: parsed.from,
          to: parsed.to,
          severity: "error",
          message: parsed.message,
        });
      } else {
        const firstLine = view.state.doc.line(1);
        diagnostics.push({
          from: firstLine.from,
          to: firstLine.to,
          severity: "error",
          message: error,
        });
      }
    }
    view.dispatch(setDiagnostics(view.state, diagnostics));
  } catch {
    // lint extension not installed or view not fully initialized
  }
}

/** Read the last query error for a specific editor view. */
export function getLastQueryError(view: EditorView): string | null {
  return queryErrorMap.get(view) ?? null;
}

// ---------------------------------------------------------------------------
// Per-editor last successful query + result snippet — gives the LLM context
// about what the user last ran and what came back.
// ---------------------------------------------------------------------------

interface QueryResultSnapshot {
  query: string;
  resultSnippet: string;
}

const queryResultMap = new WeakMap<EditorView, QueryResultSnapshot>();

const MAX_RESULT_SNIPPET_ROWS = 5;

/** Format an ES|QL response into a compact text snippet for LLM context. */
function formatResultSnippet(data: {
  columns: { name: string; type: string }[];
  values: unknown[][];
}): string {
  const cols = data.columns.map((c) => c.name);
  const rows = data.values.slice(0, MAX_RESULT_SNIPPET_ROWS);
  const header = cols.join(" | ");
  const body = rows.map((row) => row.map((v) => String(v ?? "null")).join(" | ")).join("\n");
  const total = data.values.length;
  const suffix = total > MAX_RESULT_SNIPPET_ROWS ? `\n... (${total} rows total)` : "";
  return `${header}\n${body}${suffix}`;
}

/** Store the last successful query + result for LLM context. */
export function setLastQueryResult(
  query: string,
  data: { columns: { name: string; type: string }[]; values: unknown[][] },
  view: EditorView,
) {
  const snapshot: QueryResultSnapshot = {
    query,
    resultSnippet: formatResultSnippet(data),
  };
  queryResultMap.set(view, snapshot);
}

function getLastQueryResult(view: EditorView): QueryResultSnapshot | null {
  return queryResultMap.get(view) ?? null;
}

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

    if (currentView) {
      const lastResult = getLastQueryResult(currentView);
      if (lastResult) {
        contextParts.push(
          `Last successful query:\n  ${lastResult.query}\n\nResult sample:\n${lastResult.resultSnippet}`,
        );
      }
    }

    if (currentEdits.length > 0) {
      const editLines = currentEdits.map((e) => `  - Deleted: "${e.deleted}"`).join("\n");
      contextParts.push(`Recent edits:\n${editLines}`);
    }

    if (currentView) {
      const queryError = getLastQueryError(currentView);
      if (queryError) {
        contextParts.push(`Last query error:\n  ${queryError}`);
      }
    }

    return contextParts.length > 0 ? `\n\n${contextParts.join("\n\n")}` : "";
  }

  // ---------------------------------------------------------------------------
  // Diff helper — finds the changed region between original and corrected text
  // ---------------------------------------------------------------------------

  function findDiff(
    original: string,
    corrected: string,
  ): { from: number; to: number; replacement: string } | null {
    if (original === corrected) return null;

    // Common prefix
    let prefixLen = 0;
    const minLen = Math.min(original.length, corrected.length);
    while (prefixLen < minLen && original[prefixLen] === corrected[prefixLen]) {
      prefixLen++;
    }

    // Common suffix (without overlapping with prefix)
    let suffixLen = 0;
    while (
      suffixLen < original.length - prefixLen &&
      suffixLen < corrected.length - prefixLen &&
      original[original.length - 1 - suffixLen] === corrected[corrected.length - 1 - suffixLen]
    ) {
      suffixLen++;
    }

    const from = prefixLen;
    const to = original.length - suffixLen;
    const replacement = corrected.slice(prefixLen, corrected.length - suffixLen);

    if (from === to && !replacement) return null;
    return { from, to, replacement };
  }

  // ---------------------------------------------------------------------------
  // fetchCompletion — calls the LLM, asks for the full corrected query
  // ---------------------------------------------------------------------------

  async function fetchCompletion(docText: string): Promise<string> {
    const { config } = useLLMStore.getState();
    if (!config.tabAutocompleteEnabled || !config.apiKey.trim()) {
      return "";
    }

    const contextSection = buildContextSection();

    const userMessage =
      `Here is an ES|QL query the user is editing:\n\n${docText}\n\n` +
      `Return the COMPLETE corrected/completed query. Rules:\n` +
      `- If the query contains natural language (e.g. "where agents name is bill"), ` +
      `replace it with valid ES|QL syntax.\n` +
      `- If the query looks incomplete, complete it.\n` +
      `- If the query is already valid ES|QL, return it unchanged.\n` +
      `- Preserve all valid ES|QL parts exactly as-is.\n` +
      `- Return ONLY the full query text, no explanation, no markdown fences.` +
      contextSection;

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
  // Completion trigger plugin — debounces, calls LLM, diffs, dispatches
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

        // Clear recent edits when a completion is accepted (deferred to avoid
        // dispatching during an in-progress update)
        if (update.transactions.some((tr) => tr.isUserEvent("input.complete"))) {
          const view = update.view;
          queueMicrotask(() => {
            view.dispatch({ effects: resetRecentEditsEffect.of(null) });
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
    if (!config.tabAutocompleteEnabled || !config.apiKey.trim()) {
      console.debug(
        "[llm-completion] skipped: enabled=%s, hasKey=%s",
        config.tabAutocompleteEnabled,
        !!config.apiKey.trim(),
      );
      return;
    }

    const docText = view.state.doc.toString();
    const myGeneration = ++generationId;

    console.debug("[llm-completion] gen=%d requesting completion", myGeneration);

    const correctedText = await fetchCompletion(docText);

    // Discard if a newer request has been started
    if (generationId !== myGeneration) {
      console.debug("[llm-completion] gen=%d discarded (current=%d)", myGeneration, generationId);
      return;
    }
    if (!correctedText) {
      console.debug("[llm-completion] gen=%d got empty completion", myGeneration);
      return;
    }

    // Diff original vs corrected to find the replacement range
    const diff = findDiff(docText, correctedText);
    if (!diff) {
      console.debug("[llm-completion] gen=%d no diff (query unchanged)", myGeneration);
      return;
    }

    console.debug(
      "[llm-completion] gen=%d diff: [%d,%d] → %s",
      myGeneration,
      diff.from,
      diff.to,
      diff.replacement.slice(0, 80),
    );

    view.dispatch({
      effects: setSuggestion.of(diff),
    });
  }

  return [recentEditsField, ghostDiffExtension, completionPlugin];
}

import { keymap } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { sql } from "@codemirror/lang-sql";

import type { ElasticsearchConnection } from "../services/es/client";

import { makeLLMCompletionExtension } from "./llmCompletionExtension";
import { esqlSchemaCompletionExtension } from "./esqlSchemaCompletion";

export function runQueryShortcutExtension(runQuery: () => void): Extension {
  return keymap.of([
    {
      key: "Mod-Enter",
      run: () => {
        runQuery();
        return true;
      },
    },
  ]);
}

const ESQL_COMPLETION_PROMPT =
  "You are an ES|QL expert. Complete the ES|QL query at the cursor. " +
  "If a recent query error is shown, suggest a fix. " +
  "If the user writes plain language (e.g. 'count events by host'), " +
  "complete with the valid ES|QL implementation of their intent. " +
  "Return only the completion text.";

/**
 * Build the standard ES|QL editor extension stack used by query editors:
 * SQL language mode, Mod/Cmd+Enter run-query shortcut, LLM ghost-text
 * completions, and schema-aware field/keyword autocomplete.
 *
 * When `connection` is provided, live field names are fetched from the
 * cluster and surfaced as deterministic autocomplete suggestions alongside
 * static ES|QL keywords and functions.  Falls back to keyword-only
 * completions when disconnected.
 */
export function createEsqlQueryEditorExtensions(
  runQuery: () => void,
  connection?: ElasticsearchConnection | null,
): Extension[] {
  return [
    sql(),
    runQueryShortcutExtension(runQuery),
    makeLLMCompletionExtension({ prompt: ESQL_COMPLETION_PROMPT, esqlGuide: true }),
    esqlSchemaCompletionExtension(connection ?? null),
  ];
}

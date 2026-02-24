import { keymap } from "@codemirror/view";
import { EditorState, Prec, type Extension } from "@codemirror/state";
import { SQLDialect } from "@codemirror/lang-sql";

import { makeLLMCompletionExtension } from "./llmCompletionExtension";

const esqlDialect = SQLDialect.define({ slashComments: true });

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
 * SQL-based syntax highlighting (no autocomplete), ES|QL comment syntax (//),
 * Mod/Cmd+Enter run-query shortcut, and LLM ghost-text completions.
 */
export function createEsqlQueryEditorExtensions(runQuery: () => void): Extension[] {
  return [
    esqlDialect.language,
    Prec.highest(
      EditorState.languageData.of(() => [
        { commentTokens: { line: "//", block: { open: "/*", close: "*/" } } },
      ]),
    ),
    runQueryShortcutExtension(runQuery),
    makeLLMCompletionExtension({ prompt: ESQL_COMPLETION_PROMPT, esqlGuide: true }),
  ];
}

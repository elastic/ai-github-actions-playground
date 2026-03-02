import { keymap } from "@codemirror/view";
import { EditorState, Prec, type Extension } from "@codemirror/state";
import { SQLDialect } from "@codemirror/lang-sql";
import { bracketMatching } from "@codemirror/language";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { lintGutter } from "@codemirror/lint";

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

// ---------------------------------------------------------------------------
// Local ES|QL keyword & function autocompletion (<1 ms, complements LLM)
// ---------------------------------------------------------------------------

/** @internal exported for testing */
export const ESQL_KEYWORDS = [
  "FROM",
  "WHERE",
  "EVAL",
  "STATS",
  "KEEP",
  "DROP",
  "RENAME",
  "SORT",
  "LIMIT",
  "DISSECT",
  "GROK",
  "ENRICH",
  "MV_EXPAND",
  "LOOKUP",
  "ROW",
  "SHOW",
  "BY",
  "ASC",
  "DESC",
  "NULLS",
  "FIRST",
  "LAST",
  "METADATA",
  "AND",
  "OR",
  "NOT",
  "IN",
  "LIKE",
  "RLIKE",
  "IS",
  "NULL",
  "TRUE",
  "FALSE",
  "AS",
  "FORK",
  "SAMPLE",
] as const;

/** @internal exported for testing */
export const ESQL_FUNCTIONS = [
  // Aggregation
  "COUNT",
  "AVG",
  "SUM",
  "MIN",
  "MAX",
  "PERCENTILE",
  "MEDIAN",
  "MEDIAN_ABSOLUTE_DEVIATION",
  "STD_DEV",
  "VARIANCE",
  "TOP",
  "VALUES",
  "BUCKET",
  "CATEGORIZE",
  "COUNT_DISTINCT",
  // String
  "CONCAT",
  "SUBSTRING",
  "REPLACE",
  "SPLIT",
  "TO_LOWER",
  "TO_UPPER",
  "TRIM",
  "LTRIM",
  "RTRIM",
  "LENGTH",
  "STARTS_WITH",
  "ENDS_WITH",
  "LEFT",
  "RIGHT",
  "REPEAT",
  "LOCATE",
  // Date/Time
  "NOW",
  "DATE_TRUNC",
  "DATE_EXTRACT",
  "DATE_FORMAT",
  "DATE_DIFF",
  "DATE_PARSE",
  // Math
  "ABS",
  "ROUND",
  "CEIL",
  "FLOOR",
  "POW",
  "SQRT",
  "LOG",
  "LOG10",
  "PI",
  "E",
  // Type conversion
  "TO_STRING",
  "TO_INTEGER",
  "TO_LONG",
  "TO_DOUBLE",
  "TO_BOOLEAN",
  "TO_DATETIME",
  "TO_IP",
  "TO_VERSION",
  // Conditional
  "CASE",
  "COALESCE",
  "GREATEST",
  "LEAST",
  // Multi-value
  "MV_AVG",
  "MV_COUNT",
  "MV_DEDUPE",
  "MV_FIRST",
  "MV_LAST",
  "MV_MAX",
  "MV_MIN",
  "MV_SORT",
  "MV_SUM",
  // IP
  "CIDR_MATCH",
] as const;

const ESQL_COMPLETIONS = [
  ...ESQL_KEYWORDS.map((k) => ({ label: k, type: "keyword" as const })),
  ...ESQL_FUNCTIONS.map((f) => ({ label: f, type: "function" as const, apply: f + "(" })),
];

/** @internal exported for testing */
export function esqlCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[A-Za-z_]\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: ESQL_COMPLETIONS,
    validFor: /^[A-Za-z_]\w*$/,
  };
}

/**
 * Build the standard ES|QL editor extension stack used by query editors:
 * SQL-based syntax highlighting, ES|QL comment syntax (//),
 * bracket matching & auto-close, local keyword/function autocompletion,
 * inline error diagnostics (lint gutter), Mod/Cmd+Enter run-query shortcut,
 * and LLM ghost-text completions.
 */
export function createEsqlQueryEditorExtensions(runQuery: () => void): Extension[] {
  return [
    esqlDialect.language,
    Prec.highest(
      EditorState.languageData.of(() => [
        { commentTokens: { line: "//", block: { open: "/*", close: "*/" } } },
      ]),
    ),
    bracketMatching(),
    closeBrackets(),
    keymap.of(closeBracketsKeymap),
    autocompletion({ override: [esqlCompletionSource] }),
    lintGutter(),
    runQueryShortcutExtension(runQuery),
    makeLLMCompletionExtension({ prompt: ESQL_COMPLETION_PROMPT, esqlGuide: true }),
  ];
}

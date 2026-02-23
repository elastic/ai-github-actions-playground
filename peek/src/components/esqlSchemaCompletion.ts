import { autocompletion } from "@codemirror/autocomplete";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";

import type { ElasticsearchConnection } from "../services/es/client";
import { getFieldsForIndex } from "../services/schemaCache";

// ---------------------------------------------------------------------------
// Static keyword / function lists
// ---------------------------------------------------------------------------

const ESQL_KEYWORDS = [
  "FROM",
  "WHERE",
  "STATS",
  "EVAL",
  "SORT",
  "LIMIT",
  "KEEP",
  "DROP",
  "RENAME",
  "DISSECT",
  "GROK",
  "ENRICH",
  "MV_EXPAND",
  "LOOKUP JOIN",
  "BY",
  "ASC",
  "DESC",
  "NULLS FIRST",
  "NULLS LAST",
  "AS",
  "NOT",
  "AND",
  "OR",
  "IN",
  "LIKE",
  "RLIKE",
  "IS NULL",
  "IS NOT NULL",
];

const ESQL_FUNCTIONS = [
  "COUNT(*)",
  "COUNT(",
  "AVG(",
  "SUM(",
  "MIN(",
  "MAX(",
  "PERCENTILE(",
  "COUNT_DISTINCT(",
  "MEDIAN(",
  "TOP(",
  "DATE_TRUNC(",
  "DATE_FORMAT(",
  "DATE_PARSE(",
  "NOW()",
  "ROUND(",
  "FLOOR(",
  "CEIL(",
  "ABS(",
  "LOG(",
  "LOG10(",
  "POW(",
  "CONCAT(",
  "LENGTH(",
  "LTRIM(",
  "RTRIM(",
  "TRIM(",
  "STARTS_WITH(",
  "ENDS_WITH(",
  "SUBSTRING(",
  "REPLACE(",
  "TO_UPPER(",
  "TO_LOWER(",
  "COALESCE(",
  "TO_INTEGER(",
  "TO_LONG(",
  "TO_DOUBLE(",
  "TO_BOOLEAN(",
  "TO_STRING(",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the first index pattern from a `FROM <pattern>` clause.
 * Returns `null` when no FROM clause is found.
 *
 * @example extractIndexPattern("FROM logs-* | WHERE @timestamp > NOW()")
 *          // => "logs-*"
 */
export function extractIndexPattern(queryText: string): string | null {
  const match = /\bFROM\s+([^\s|,]+)/i.exec(queryText);
  return match?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// Extension factory
// ---------------------------------------------------------------------------

/**
 * Returns a CodeMirror extension that adds schema-aware ES|QL completions.
 *
 * When `connection` is provided, field names and types are fetched from the
 * cluster via `_field_caps` (using the bounded schema cache) and merged with
 * static keyword/function suggestions.  Field suggestions are ranked above
 * keywords so users see relevant field names first.
 *
 * Falls back to keyword-only completions when `connection` is `null`
 * (disconnected mode) or when the cluster is unreachable.
 */
export function esqlSchemaCompletionExtension(
  connection: ElasticsearchConnection | null,
): Extension {
  const completionSource = async (context: CompletionContext): Promise<CompletionResult | null> => {
    // Match identifiers including dots, @-signs, wildcards, and hyphens
    const word = context.matchBefore(/[\w.@*-]*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    const queryText = context.state.doc.toString();
    const indexPattern = extractIndexPattern(queryText);

    const staticOptions = [
      ...ESQL_KEYWORDS.map((kw) => ({
        label: kw,
        type: "keyword" as const,
        boost: 0,
      })),
      ...ESQL_FUNCTIONS.map((fn) => ({
        label: fn,
        type: "function" as const,
        boost: 0,
      })),
    ];

    // Fetch live field suggestions when connected and index pattern is known
    let fieldOptions: CompletionResult["options"] = [];
    if (connection && indexPattern) {
      const fields = await getFieldsForIndex(connection, indexPattern);
      fieldOptions = fields.map((f) => ({
        label: f.name,
        type: "variable" as const,
        detail: f.type,
        boost: 1, // Rank fields above static keywords/functions
      }));
    }

    return {
      from: word.from,
      options: [...fieldOptions, ...staticOptions],
    };
  };

  return autocompletion({ override: [completionSource] });
}
